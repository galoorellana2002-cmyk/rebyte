import {
  addDays,
  daysBetween,
  isSellable,
  PAYMENTS,
  round2,
  saleTotals,
  STALE_DAYS,
  STATUSES,
  today,
  TYPES,
  validateEquipment,
} from '../shared/catalog.js';
import { all, get, run, tx } from './db.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const COLUMNS = [
  'type', 'brand', 'model', 'cpu', 'ram_gb', 'storage_gb', 'storage_type', 'screen_in', 'battery_pct',
  'serial', 'grade', 'cost', 'price', 'warranty_days', 'status', 'source', 'notes', 'received_at',
];
const params = (v) => COLUMNS.map((c) => (v[c] === '' || v[c] === undefined ? null : v[c]));

/* ---------- Equipos ---------- */

export function listEquipment() {
  return all(`
    SELECT e.*, (
      SELECT s.number FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE si.equipment_id = e.id AND s.voided_at IS NULL
    ) AS sale_number
    FROM equipment e
    ORDER BY e.received_at DESC, e.id DESC
  `);
}

export const getEquipment = (id) => get('SELECT * FROM equipment WHERE id = ?', id);

function mustGetEquipment(id) {
  const row = getEquipment(Number(id));
  if (!row) throw new HttpError(404, 'No existe ese equipo.');
  return row;
}

function nextCode(type) {
  const prefix = TYPES[type].prefix;
  const row = get("SELECT code FROM equipment WHERE code LIKE ? ORDER BY code DESC LIMIT 1", `${prefix}-%`);
  const n = row ? Number(row.code.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function validated(input, now) {
  const { ok, value, errors } = validateEquipment(input, now);
  if (!ok) throw new HttpError(400, 'Revisa los campos marcados.', errors);
  return value;
}

export function createEquipment(input, { date = today() } = {}) {
  const v = validated(input, date);
  const stamp = new Date().toISOString();
  return tx(() => {
    const code = nextCode(v.type);
    const { lastInsertRowid } = run(
      `INSERT INTO equipment (code, ${COLUMNS.join(', ')}, created_at, updated_at)
       VALUES (?, ${COLUMNS.map(() => '?').join(', ')}, ?, ?)`,
      code, ...params(v), stamp, stamp,
    );
    return getEquipment(Number(lastInsertRowid));
  });
}

export function updateEquipment(id, input) {
  const current = mustGetEquipment(id);
  if (current.status === 'vendido') {
    throw new HttpError(409, `${current.code} ya se vendió. Anula la venta si necesitas modificarlo.`);
  }
  const v = validated(input, today());
  run(
    `UPDATE equipment SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...params(v), new Date().toISOString(), current.id,
  );
  return getEquipment(current.id);
}

export function deleteEquipment(id) {
  const current = mustGetEquipment(id);
  if (current.status === 'vendido') throw new HttpError(409, `${current.code} está vendido y no se puede eliminar.`);
  if (get('SELECT 1 FROM sale_items WHERE equipment_id = ?', current.id)) {
    throw new HttpError(409, `${current.code} tiene ventas anuladas en su historial; márcalo «En revisión» en lugar de eliminarlo.`);
  }
  run('DELETE FROM equipment WHERE id = ?', current.id);
  return { id: current.id };
}

/* ---------- Ventas ---------- */

const ITEMS_SQL = `
  SELECT si.sale_id, si.price, si.cost, e.id, e.code, e.type, e.brand, e.model, e.cpu, e.ram_gb,
         e.storage_gb, e.storage_type, e.screen_in, e.battery_pct, e.serial, e.grade, e.warranty_days
  FROM sale_items si JOIN equipment e ON e.id = si.equipment_id
`;

function withItems(sales) {
  if (!sales.length) return [];
  const ids = sales.map((s) => s.id);
  const items = all(`${ITEMS_SQL} WHERE si.sale_id IN (${ids.map(() => '?').join(',')}) ORDER BY e.code`, ...ids);
  return sales.map((s) => {
    const own = items.filter((i) => i.sale_id === s.id);
    const cost = round2(own.reduce((sum, i) => sum + i.cost, 0));
    return { ...s, items: own, cost, profit: round2(s.total - cost) };
  });
}

export const listSales = () => withItems(all('SELECT * FROM sales ORDER BY date DESC, id DESC'));

export function getSale(id) {
  const sale = get('SELECT * FROM sales WHERE id = ?', Number(id));
  if (!sale) throw new HttpError(404, 'No existe esa venta.');
  return withItems([sale])[0];
}

function nextSaleNumber() {
  const row = get('SELECT number FROM sales ORDER BY id DESC LIMIT 1');
  const n = row ? Number(row.number.slice(2)) + 1 : 1;
  return `V-${String(n).padStart(5, '0')}`;
}

const text = (v) => (v == null ? '' : String(v).trim());

export function createSale(input = {}, { date = today() } = {}) {
  const customer = input.customer ?? {};
  const name = text(customer.name);
  const doc = text(customer.doc);
  const phone = text(customer.phone);
  const errors = {};
  if (!name) errors.name = 'Escribe el nombre del cliente.';
  else if (name.length > 80) errors.name = 'Máximo 80 caracteres.';
  if (doc && !/^\d{10}(\d{3})?$/.test(doc)) errors.doc = 'La cédula tiene 10 dígitos y el RUC 13.';
  if (phone.length > 20) errors.phone = 'Máximo 20 caracteres.';
  if (!PAYMENTS[input.payment]) errors.payment = 'Elige la forma de pago.';
  const discount = input.discount === '' || input.discount == null ? 0 : Number(input.discount);
  if (!Number.isFinite(discount) || discount < 0) errors.discount = 'El descuento no puede ser negativo.';

  const ids = Array.isArray(input.items) ? input.items.map(Number) : [];
  if (!ids.length) throw new HttpError(400, 'Agrega al menos un equipo a la venta.');
  if (ids.length > 50 || new Set(ids).size !== ids.length) throw new HttpError(400, 'La lista de equipos no es válida.');

  return tx(() => {
    const items = ids.map(mustGetEquipment);
    const blocked = items.find((e) => !isSellable(e));
    if (blocked) {
      throw new HttpError(409, `${blocked.code} no se puede vender: está «${STATUSES[blocked.status]}».`);
    }
    const totals = saleTotals(items.map((e) => e.price), discount);
    if (!errors.discount && totals.discount > totals.subtotal) errors.discount = 'El descuento supera el subtotal.';
    if (Object.keys(errors).length) throw new HttpError(400, 'Revisa los datos de la venta.', errors);

    const stamp = new Date().toISOString();
    const { lastInsertRowid } = run(
      `INSERT INTO sales (number, date, customer_name, customer_doc, customer_phone, payment, subtotal, discount, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nextSaleNumber(), date, name, doc || null, phone || null, input.payment,
      totals.subtotal, totals.discount, totals.total, stamp,
    );
    const saleId = Number(lastInsertRowid);
    for (const e of items) {
      run('INSERT INTO sale_items (sale_id, equipment_id, price, cost) VALUES (?, ?, ?, ?)', saleId, e.id, e.price, e.cost);
      run("UPDATE equipment SET status = 'vendido', sold_at = ?, updated_at = ? WHERE id = ?", date, stamp, e.id);
    }
    return getSale(saleId);
  });
}

export function voidSale(id) {
  const sale = getSale(id);
  if (sale.voided_at) throw new HttpError(409, `La venta ${sale.number} ya estaba anulada.`);
  const stamp = new Date().toISOString();
  tx(() => {
    run('UPDATE sales SET voided_at = ? WHERE id = ?', stamp, sale.id);
    for (const item of sale.items) {
      run("UPDATE equipment SET status = 'disponible', sold_at = NULL, updated_at = ? WHERE id = ?", stamp, item.id);
    }
  });
  return getSale(sale.id);
}

/* ---------- Resumen ---------- */

export function summary(now = today()) {
  const equipment = all('SELECT * FROM equipment');
  const sales = listSales().filter((s) => !s.voided_at);
  const stock = equipment.filter((e) => e.status !== 'vendido');
  const sum = (rows, key) => round2(rows.reduce((s, r) => s + r[key], 0));

  const byStatus = Object.fromEntries(Object.keys(STATUSES).map((k) => [k, equipment.filter((e) => e.status === k).length]));
  const byType = Object.entries(TYPES).map(([type, { label }]) => {
    const rows = stock.filter((e) => e.type === type);
    return { type, label, count: rows.length, cost: sum(rows, 'cost'), price: sum(rows, 'price') };
  });

  // Últimos 6 meses, incluido el actual.
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const month = d.toISOString().slice(0, 7);
    const rows = sales.filter((s) => s.date.startsWith(month));
    months.push({ month, count: rows.length, revenue: sum(rows, 'total'), profit: sum(rows, 'profit') });
  }

  const stale = stock
    .filter((e) => e.status !== 'revision')
    .map((e) => ({ ...e, days: daysBetween(e.received_at, now) }))
    .filter((e) => e.days >= STALE_DAYS)
    .sort((a, b) => b.days - a.days);

  const since = addDays(now, -90);
  const sold = equipment.filter((e) => e.status === 'vendido' && e.sold_at >= since);
  const avgDaysToSell = sold.length
    ? Math.round(sold.reduce((s, e) => s + daysBetween(e.received_at, e.sold_at), 0) / sold.length)
    : null;

  return {
    date: now,
    stock: {
      count: stock.length,
      cost: sum(stock, 'cost'),
      price: sum(stock, 'price'),
      profit: round2(sum(stock, 'price') - sum(stock, 'cost')),
    },
    byStatus,
    byType,
    month: months.at(-1),
    months,
    stale,
    avgDaysToSell,
    recentSales: sales.slice(0, 5),
  };
}
