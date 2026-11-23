import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, saleTotals, specsLine, today, validateEquipment } from '../shared/catalog.js';
import { resetDemo } from '../server/seed.js';
import { createEquipment, createSale, deleteEquipment, getEquipment, summary, updateEquipment, voidSale } from '../server/store.js';

const laptop = {
  type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T14', cpu: 'Ryzen 5 4650U', ram_gb: '16', storage_gb: '512',
  storage_type: 'SSD', screen_in: '14', battery_pct: '90', grade: 'A', cost: '250', price: '399', warranty_days: '60',
};

test('valida campos obligatorios y descarta especificaciones que no aplican', () => {
  const bad = validateEquipment({ type: 'monitor', price: 0 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.brand && bad.errors.model && bad.errors.grade && bad.errors.cost && bad.errors.price);

  const { ok, value } = validateEquipment({ ...laptop, type: 'monitor', screen_in: '27' });
  assert.equal(ok, true);
  assert.equal(value.cpu, '');
  assert.equal(value.ram_gb, null);
  assert.equal(value.battery_pct, null);
  assert.equal(value.screen_in, 27);
});

test('no acepta fechas de ingreso futuras', () => {
  const r = validateEquipment({ ...laptop, received_at: addDays(today(), 1) });
  assert.ok(r.errors.received_at);
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

test('venta: marca vendidos, bloquea reventa y la anulación los devuelve', () => {
  resetDemo();
  const a = createEquipment(laptop);
  const b = createEquipment({ ...laptop, type: 'monitor', model: 'P2422H', screen_in: 24, cost: 80, price: 139 });
  assert.match(a.code, /^LAP-\d{4}$/);
  assert.match(b.code, /^MON-\d{4}$/);

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
  resetDemo();
  const a = createEquipment({ ...laptop, price: 100 });
  assert.throws(() => createSale({ customer: { name: 'X' }, payment: 'efectivo', discount: 150, items: [a.id] }), { status: 400 });
  const r = createEquipment({ ...laptop, status: 'revision' });
  assert.throws(() => createSale({ customer: { name: 'X' }, payment: 'efectivo', items: [r.id] }), { status: 409 });
});

test('el resumen de la demo tiene stock, ventas del mes y equipos estancados', () => {
  resetDemo();
  const s = summary();
  assert.equal(s.stock.count, 22);
  assert.equal(s.months.length, 6);
  assert.ok(s.month.revenue > 0);
  assert.ok(s.stale.length >= 3);
  assert.ok(s.stale.every((e) => e.days >= 60 && e.status !== 'vendido'));
});
