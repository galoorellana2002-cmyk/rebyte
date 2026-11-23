import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addDays, saleTotals, specsLine, today, validateEquipment } from '../shared/catalog.js';
import { rowToEquipment, titleCase } from '../server/importer.js';
import {
  clearAll,
  createEquipment,
  createSale,
  deleteEquipment,
  getEquipment,
  summary,
  updateEquipment,
  voidSale,
} from '../server/store.js';

const laptop = {
  type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T14', cpu: 'Ryzen 5 4650U', ram_gb: '16', storage_gb: '512',
  storage_type: 'SSD', screen_in: '14', battery_pct: '90', grade: 'A', cost: '250', price: '399', warranty_days: '60',
};

beforeEach(() => clearAll());

test('valida campos obligatorios y descarta especificaciones que no aplican', () => {
  const bad = validateEquipment({ type: 'monitor', price: 0, code: 'mal código!' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.brand && bad.errors.model && bad.errors.grade && bad.errors.cost && bad.errors.price && bad.errors.code);

  const { ok, value } = validateEquipment({ ...laptop, type: 'monitor', screen_in: '27', code: 'mnt9' });
  assert.equal(ok, true);
  assert.equal(value.code, 'MNT9');
  assert.equal(value.cpu, '');
  assert.equal(value.ram_gb, null);
  assert.equal(value.screen_in, 27);
});

test('no acepta fechas de ingreso futuras', () => {
  assert.ok(validateEquipment({ ...laptop, received_at: addDays(today(), 1) }).errors.received_at);
});

test('arma la línea de especificaciones', () => {
  assert.equal(
    specsLine({ cpu: 'i5', ram_gb: 8, storage_gb: 1000, storage_type: 'HDD', screen_in: 15.6, battery_pct: 70 }),
    'i5 · 8 GB RAM · 1 TB HDD · 15.6" · batería 70%',
  );
});

test('calcula totales con descuento', () => {
  assert.deepEqual(saleTotals([349.9, 129.1], 20), { subtotal: 479, discount: 20, total: 459 });
});

test('códigos: siguen la numeración del tipo y no se repiten', () => {
  createEquipment({ ...laptop, code: 'LPT4' });
  assert.equal(createEquipment(laptop).code, 'LPT5');
  assert.throws(() => createEquipment({ ...laptop, code: 'lpt4' }), (err) => err.status === 400 && Boolean(err.details.code));
  assert.equal(createEquipment({ ...laptop, type: 'monitor', model: 'P2422H', screen_in: 24 }).code, 'MNT1');
});

test('venta: marca vendidos, bloquea reventa y la anulación los devuelve', () => {
  const a = createEquipment(laptop);
  const b = createEquipment({ ...laptop, type: 'monitor', model: 'P2422H', screen_in: 24, cost: 80, price: 139 });

  const sale = createSale({ customer: { name: 'Cliente Prueba' }, payment: 'efectivo', discount: 38, items: [a.id, b.id] });
  assert.equal(sale.total, 500);
  assert.equal(sale.profit, 500 - 330);
  assert.equal(getEquipment(a.id).status, 'vendido');

  assert.throws(() => createSale({ customer: { name: 'Otro' }, payment: 'efectivo', items: [a.id] }), { status: 409 });
  assert.throws(() => updateEquipment(a.id, laptop), { status: 409 });
  assert.throws(() => deleteEquipment(a.id), { status: 409 });

  voidSale(sale.id);
  assert.equal(getEquipment(a.id).status, 'disponible');
  assert.equal(getEquipment(a.id).sold_at, null);
  assert.throws(() => voidSale(sale.id), { status: 409 });
});

test('rechaza descuentos mayores al subtotal y equipos en revisión', () => {
  const a = createEquipment({ ...laptop, price: 100 });
  assert.throws(() => createSale({ customer: { name: 'X' }, payment: 'efectivo', discount: 150, items: [a.id] }), { status: 400 });
  const r = createEquipment({ ...laptop, status: 'revision' });
  assert.throws(() => createSale({ customer: { name: 'X' }, payment: 'efectivo', items: [r.id] }), { status: 409 });
});

test('resumen: stock, ventas del mes y equipos estancados', () => {
  const old = createEquipment({ ...laptop, received_at: addDays(today(), -90) });
  const sold = createEquipment(laptop);
  createSale({ customer: { name: 'X' }, payment: 'efectivo', items: [sold.id] });
  const s = summary();
  assert.equal(s.stock.count, 1);
  assert.equal(s.month.revenue, 399);
  assert.deepEqual(s.stale.map((e) => e.id), [old.id]);
});

/* ---------- Importación del Excel ---------- */

const row = {
  type: 'LAPTOP', brand: 'HP', model: '450 G4', serial: 'ABC123', asset: "'10860", cpu: 'CORE I5', speed: '2.60 Ghz',
  ram: '8 GB', disk: '1 TB', diskType: 'SATA', optical: 'DVD/RW', os: 'WINDOWS 10 PRO - DIGITAL', supplier: 'PROVEEDOR UNO',
  bought: new Date('2017-04-01T00:00:00Z'), condition: 'REPOTENCIADO', code: 'lpt 9', price: 150,
  reviewed: new Date('2025-01-07T00:00:00Z'), reservedBy: 'PERSONA DE PRUEBA', reservedAt: new Date('2025-02-01T00:00:00Z'), sold: 'SI',
};

test('normaliza mayúsculas del Excel', () => {
  assert.equal(titleCase('CORE I5'), 'Core i5');
  assert.equal(titleCase('WINDOWS 10 PRO - DIGITAL'), 'Windows 10 Pro - Digital');
  assert.equal(titleCase('MA. JOSE PEREZ'), 'Ma. Jose Perez');
  assert.equal(titleCase('HP'), 'HP');
});

test('convierte una fila del Excel en equipo', () => {
  const r = rowToEquipment(row, '2026-11-23');
  assert.equal(r.code, 'LPT9');
  assert.equal(r.sold, true);
  assert.deepEqual(r.reservation, { name: 'Persona De Prueba', date: '2025-02-01' });
  assert.equal(r.input.type, 'laptop');
  assert.equal(r.input.cpu, 'Core i5 2.60 GHz');
  assert.equal(r.input.ram_gb, 8);
  assert.equal(r.input.storage_gb, 1000);
  assert.equal(r.input.storage_type, 'HDD');
  assert.equal(r.input.grade, 'A');
  assert.equal(r.input.source, 'Activo 10860 · PROVEEDOR UNO, 2017');
  assert.match(r.input.notes, /Windows 10 Pro \(licencia digital\)/);
  assert.equal(validateEquipment(r.input, '2026-11-23').ok, true);
});

test('fila reservada sin vender queda «Reservado» y anota quién', () => {
  const r = rowToEquipment({ ...row, sold: 'NO', condition: 'DE BAJA', asset: 's01' }, '2026-11-23');
  assert.equal(r.sold, false);
  assert.equal(r.input.status, 'reservado');
  assert.equal(r.input.grade, 'C');
  assert.match(r.input.notes, /Reservado por Persona De Prueba \(01\/02\/2025\)/);
  assert.doesNotMatch(r.input.source, /s01/);
});

test('salta filas sin código o con tipo desconocido', () => {
  assert.ok(rowToEquipment({ ...row, code: '' }).skip);
  assert.ok(rowToEquipment({ ...row, type: 'IMPRESORA' }).skip);
});
