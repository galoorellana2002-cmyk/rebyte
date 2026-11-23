// Importa el Excel «Equipos para la venta» (una fila por equipo) al inventario.
// Es idempotente: los códigos de venta que ya existen se saltan, así que el
// mismo archivo, o la versión del mes siguiente, se puede volver a importar.

import ExcelJS from 'exceljs';
import { addDays, today } from '../shared/catalog.js';
import { get, tx } from './db.js';
import { createEquipment, createSale } from './store.js';

// Columna del Excel → campo. Los encabezados se comparan sin tildes ni mayúsculas.
const COLUMNS = {
  type: 'TIPO',
  brand: 'MARCA',
  model: 'MODELO',
  serial: 'SERIE',
  asset: 'CODIGO ACTIVO',
  cpu: 'PROCESADOR',
  speed: 'VELOCIDAD',
  ram: 'MEMORIA',
  disk: 'HDD1',
  diskType: 'TIPO_1',
  optical: 'UNIDAD OPTICA',
  os: 'SISTEMA OPERT.',
  supplier: 'PROVEEDOR',
  bought: 'FECHA COMPRA',
  condition: 'ESTADO',
  code: 'COD. VENTA',
  price: 'VALOR DE VENTA',
  reviewed: 'F. REVISION BODEGA',
  reservedBy: 'RESERVADO POR',
  reservedAt: 'FECHA RESERVA',
  sold: 'VENDIDO',
};

const TYPE_MAP = { DESKTOP: 'desktop', CPU: 'desktop', AIO: 'desktop', LAPTOP: 'laptop', PORTATIL: 'laptop', MONITOR: 'monitor', TABLET: 'tablet' };

// Estado técnico del Excel → condición A/B/C.
const GRADE_MAP = { REPOTENCIADO: 'A', FUNCIONAL: 'B' };

const KEEP_UPPER = new Set(['HP', 'LG', 'AMD', 'SSD', 'HDD', 'DVD', 'CD', 'RW', 'GB', 'TB', 'GHZ']);

const plain = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return isoDate(v);
  if (typeof v === 'object') return cellText(v.result ?? v.text ?? v.richText?.map((t) => t.text).join('') ?? '');
  return String(v).replace(/^'/, '').trim();
}

function isoDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim());
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/** «CORE I5» → «Core i5», «WINDOWS 10 PRO» → «Windows 10 Pro», «HP» queda igual. */
export function titleCase(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\s/-]+/g, (w) => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up.replace(/\.$/, ''))) return up === 'GHZ' ? 'GHz' : up;
      if (/^i\d$/.test(w)) return w;
      if (/\d/.test(w)) return up;
      return w[0].toUpperCase() + w.slice(1);
    });
}

function sizeGb(v) {
  const m = /([\d.,]+)\s*(TB|GB)/i.exec(cellText(v));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Math.round(m[2].toUpperCase() === 'TB' ? n * 1000 : n);
}

/**
 * Convierte una fila (objeto campo → valor) en los datos de un equipo.
 * Devuelve { code, input, reservation, sold, warnings } o { skip: motivo }.
 */
export function rowToEquipment(row, now = today()) {
  const code = plain(row.code).replace(/\s+/g, '');
  const typeKey = plain(row.type);
  const type = TYPE_MAP[typeKey];
  if (!code) return { skip: 'sin código de venta' };
  if (!type) return { skip: `tipo «${cellText(row.type) || 'vacío'}» no reconocido`, code };

  const warnings = [];
  const condition = plain(row.condition);
  const os = titleCase(cellText(row.os)).replace(/\s*-\s*Digital$/i, ' (licencia digital)');
  const notes = [os, cellText(row.optical), condition && `Estado: ${titleCase(condition)}`].filter(Boolean);

  let received = isoDate(row.reviewed) || now;
  if (received > now) {
    warnings.push(`fecha de revisión ${received} en el futuro; se usó hoy`);
    received = now;
  }

  const sold = plain(row.sold) === 'SI';
  const reservedBy = titleCase(cellText(row.reservedBy));
  const reservedAt = isoDate(row.reservedAt);
  if (sold && !reservedBy) warnings.push('marcado como vendido pero sin «Reservado por»; se dejó disponible');
  if (!sold && reservedBy) {
    notes.push(`Reservado por ${reservedBy}${reservedAt ? ` (${reservedAt.split('-').reverse().join('/')})` : ''}`);
  }

  const asset = cellText(row.asset);
  const boughtYear = isoDate(row.bought).slice(0, 4);
  const source = [
    asset && !/^s0\d$/i.test(asset) && `Activo ${asset}`,
    [cellText(row.supplier), boughtYear && boughtYear <= now.slice(0, 4) && boughtYear].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  const cpu = [titleCase(cellText(row.cpu)), cellText(row.speed).replace(/ghz/i, 'GHz')].filter(Boolean).join(' ');
  const diskType = plain(row.diskType);
  const storage = sizeGb(row.disk);

  return {
    code,
    sold: sold && Boolean(reservedBy),
    reservation: reservedBy ? { name: reservedBy, date: reservedAt } : null,
    warnings,
    input: {
      code,
      type,
      brand: titleCase(cellText(row.brand)),
      model: cellText(row.model),
      serial: cellText(row.serial),
      cpu,
      ram_gb: sizeGb(row.ram),
      storage_gb: storage,
      storage_type: storage ? (diskType === 'SSD' ? 'SSD' : 'HDD') : '',
      grade: GRADE_MAP[condition] ?? 'C',
      // Son activos ya depreciados: no hay costo de compra que recuperar.
      cost: 0,
      price: Number(row.price),
      warranty_days: 0,
      status: !sold && reservedBy ? 'reservado' : 'disponible',
      source: source.slice(0, 80),
      notes: notes.join(' · ').slice(0, 500),
      received_at: received,
    },
  };
}

/** Lee la primera hoja y devuelve las filas como objetos con las claves de COLUMNS. */
export async function readRows(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const header = ws.getRow(1).values.map(plain);
  const index = {};
  const missing = [];
  for (const [key, name] of Object.entries(COLUMNS)) {
    const i = header.indexOf(plain(name));
    if (i === -1) missing.push(name);
    else index[key] = i;
  }
  const required = ['TIPO', 'MARCA', 'MODELO', 'COD. VENTA', 'VALOR DE VENTA'];
  const lacking = missing.filter((m) => required.includes(m));
  if (lacking.length) throw new Error(`Faltan columnas en el Excel: ${lacking.join(', ')}`);

  const rows = [];
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const row = { line: n };
    for (const [key, i] of Object.entries(index)) row[key] = r.getCell(i).value;
    if (Object.values(row).some((v) => v !== n && cellText(v))) rows.push(row);
  });
  return rows;
}

export async function importWorkbook(file, now = today()) {
  const rows = await readRows(file);
  const report = { created: [], skipped: [], errors: [], warnings: [], sales: [] };

  tx(() => {
    const sold = new Map();
    for (const row of rows) {
      const parsed = rowToEquipment(row, now);
      if (parsed.skip) {
        report.errors.push(`Fila ${row.line}${parsed.code ? ` (${parsed.code})` : ''}: ${parsed.skip}`);
        continue;
      }
      if (get('SELECT 1 FROM equipment WHERE code = ?', parsed.code)) {
        report.skipped.push(parsed.code);
        continue;
      }
      try {
        const e = createEquipment(parsed.input, { date: now });
        report.created.push(e.code);
        for (const w of parsed.warnings) report.warnings.push(`${e.code}: ${w}`);
        if (parsed.sold) {
          // Una venta por cliente y fecha de reserva; nunca antes de que el equipo entrara a bodega.
          const key = `${parsed.reservation.name}|${parsed.reservation.date}`;
          const group = sold.get(key) ?? { name: parsed.reservation.name, date: parsed.reservation.date, items: [] };
          group.items.push(e);
          sold.set(key, group);
        }
      } catch (err) {
        const detail = err.details ? Object.entries(err.details).map(([k, m]) => `${k}: ${m}`).join('; ') : err.message;
        report.errors.push(`Fila ${row.line} (${parsed.code}): ${detail}`);
      }
    }

    const groups = [...sold.values()].map((g) => {
      const latest = g.items.reduce((d, e) => (e.received_at > d ? e.received_at : d), g.date || '');
      return { ...g, date: latest > now ? now : latest || addDays(now, 0) };
    });
    groups.sort((a, b) => a.date.localeCompare(b.date));
    for (const g of groups) {
      const sale = createSale(
        { customer: { name: g.name }, payment: 'no_registrado', discount: 0, items: g.items.map((e) => e.id) },
        { date: g.date },
      );
      report.sales.push(sale);
    }
  });

  return report;
}
