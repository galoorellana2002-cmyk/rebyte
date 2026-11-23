// Reglas del negocio que comparten el servidor y la interfaz.

export const TYPES = {
  laptop: { label: 'Laptop', prefix: 'LAP', fields: ['cpu', 'ram_gb', 'storage', 'screen_in', 'battery_pct'] },
  desktop: { label: 'Desktop', prefix: 'DES', fields: ['cpu', 'ram_gb', 'storage'] },
  monitor: { label: 'Monitor', prefix: 'MON', fields: ['screen_in'] },
  tablet: { label: 'Tablet', prefix: 'TAB', fields: ['ram_gb', 'storage', 'screen_in', 'battery_pct'] },
  accesorio: { label: 'Accesorio', prefix: 'ACC', fields: [] },
};

export const GRADES = {
  A: 'Como nuevo',
  B: 'Marcas leves',
  C: 'Uso visible',
};

export const STATUSES = {
  revision: 'En revisión',
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
};

/** Estados que se eligen a mano; «vendido» solo lo pone una venta. */
export const EDITABLE_STATUSES = ['revision', 'disponible', 'reservado'];
export const SELLABLE_STATUSES = ['disponible', 'reservado'];

export const STORAGE_TYPES = ['SSD', 'HDD', 'eMMC'];

export const PAYMENTS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

/** A partir de estos días en bodega un equipo se considera estancado. */
export const STALE_DAYS = 60;

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fecha local de Ecuador en formato AAAA-MM-DD. */
export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(now);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function margin(cost, price) {
  const profit = round2(price - cost);
  return { profit, pct: price > 0 ? profit / price : 0 };
}

export function storageLabel(gb, kind) {
  if (!gb) return '';
  const size = gb >= 1000 ? `${round2(gb / 1000)} TB` : `${gb} GB`;
  return kind ? `${size} ${kind}` : size;
}

/** Resumen corto de especificaciones: «i5-8350U · 16 GB RAM · 256 GB SSD · 14"». */
export function specsLine(e) {
  const parts = [];
  if (e.cpu) parts.push(e.cpu);
  if (e.ram_gb) parts.push(`${e.ram_gb} GB RAM`);
  if (e.storage_gb) parts.push(storageLabel(e.storage_gb, e.storage_type));
  if (e.screen_in) parts.push(`${e.screen_in}"`);
  if (e.battery_pct != null) parts.push(`batería ${e.battery_pct}%`);
  return parts.join(' · ');
}

export const isSellable = (e) => SELLABLE_STATUSES.includes(e.status);

const text = (v) => (v == null ? '' : String(v).trim());

function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida y normaliza un equipo. Devuelve { ok, value, errors } donde errors
 * es un objeto campo → mensaje, listo para mostrarse junto a cada campo.
 */
export function validateEquipment(input = {}, now = today()) {
  const errors = {};
  const type = text(input.type);
  if (!TYPES[type]) errors.type = 'Elige el tipo de equipo.';
  const fields = TYPES[type]?.fields ?? [];

  const v = {
    type,
    brand: text(input.brand),
    model: text(input.model),
    serial: text(input.serial),
    source: text(input.source),
    notes: text(input.notes),
    grade: text(input.grade),
    status: text(input.status) || 'disponible',
  };

  if (!v.brand) errors.brand = 'Escribe la marca.';
  else if (v.brand.length > 40) errors.brand = 'Máximo 40 caracteres.';
  if (!v.model) errors.model = 'Escribe el modelo.';
  else if (v.model.length > 80) errors.model = 'Máximo 80 caracteres.';
  if (v.serial.length > 60) errors.serial = 'Máximo 60 caracteres.';
  if (v.source.length > 80) errors.source = 'Máximo 80 caracteres.';
  if (v.notes.length > 500) errors.notes = 'Máximo 500 caracteres.';
  if (!GRADES[v.grade]) errors.grade = 'Elige la condición.';
  if (!EDITABLE_STATUSES.includes(v.status)) errors.status = 'Estado no válido.';

  v.cost = num(input.cost);
  if (v.cost === null || Number.isNaN(v.cost) || v.cost < 0) errors.cost = 'Escribe el costo (0 o más).';
  else v.cost = round2(v.cost);

  v.price = num(input.price);
  if (v.price === null || Number.isNaN(v.price) || v.price <= 0) errors.price = 'Escribe un precio mayor a 0.';
  else v.price = round2(v.price);

  v.warranty_days = num(input.warranty_days) ?? 0;
  if (!Number.isInteger(v.warranty_days) || v.warranty_days < 0 || v.warranty_days > 365) {
    errors.warranty_days = 'Entre 0 y 365 días.';
  }

  v.received_at = text(input.received_at) || now;
  if (!DATE_RE.test(v.received_at) || Number.isNaN(Date.parse(v.received_at))) errors.received_at = 'Fecha no válida.';
  else if (v.received_at > now) errors.received_at = 'La fecha no puede ser futura.';

  // Especificaciones: solo las que aplican al tipo; el resto queda vacío.
  v.cpu = fields.includes('cpu') ? text(input.cpu) : '';
  if (v.cpu.length > 60) errors.cpu = 'Máximo 60 caracteres.';

  const intField = (key, min, max, applies, message) => {
    const n = applies ? num(input[key]) : null;
    if (n !== null && (!Number.isInteger(n) || n < min || n > max)) errors[key] = message;
    v[key] = n;
  };
  intField('ram_gb', 1, 256, fields.includes('ram_gb'), 'Entre 1 y 256 GB.');
  intField('storage_gb', 1, 16000, fields.includes('storage'), 'Entre 1 y 16000 GB.');
  intField('battery_pct', 0, 100, fields.includes('battery_pct'), 'Entre 0 y 100 %.');

  v.storage_type = v.storage_gb ? text(input.storage_type) || 'SSD' : '';
  if (v.storage_type && !STORAGE_TYPES.includes(v.storage_type)) errors.storage_type = 'Tipo no válido.';

  const screen = fields.includes('screen_in') ? num(input.screen_in) : null;
  if (screen !== null && (Number.isNaN(screen) || screen < 7 || screen > 65)) errors.screen_in = 'Entre 7 y 65 pulgadas.';
  v.screen_in = screen === null || Number.isNaN(screen) ? screen : Math.round(screen * 10) / 10;

  return { ok: Object.keys(errors).length === 0, value: v, errors };
}

export function saleTotals(prices, discount = 0) {
  const subtotal = round2(prices.reduce((s, p) => s + p, 0));
  const d = round2(Number(discount) || 0);
  return { subtotal, discount: d, total: round2(subtotal - d) };
}
