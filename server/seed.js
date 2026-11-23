import { addDays, today } from '../shared/catalog.js';
import { get, run, tx } from './db.js';
import { createEquipment, createSale } from './store.js';

// [tipo, marca, modelo, cpu, ram, almacenamiento, tipo alm., pantalla, batería, condición, costo, precio, garantía, estado, origen, días desde ingreso]
const ITEMS = [
  ['laptop', 'Lenovo', 'ThinkPad T480', 'Core i5-8350U', 16, 256, 'SSD', 14, 82, 'B', 210, 349, 90, 'disponible', 'Lote corporativo Quito', 75],
  ['laptop', 'Dell', 'Latitude 7490', 'Core i7-8650U', 16, 512, 'SSD', 14, 88, 'A', 260, 429, 90, 'disponible', 'Lote corporativo Quito', 75],
  ['laptop', 'HP', 'EliteBook 840 G5', 'Core i5-8250U', 8, 256, 'SSD', 14, 74, 'B', 180, 299, 60, 'disponible', 'Lote corporativo Quito', 40],
  ['laptop', 'Apple', 'MacBook Air M1 (2020)', 'Apple M1', 8, 256, 'SSD', 13.3, 91, 'A', 480, 689, 90, 'reservado', 'Cliente particular', 12],
  ['laptop', 'Lenovo', 'ThinkPad X1 Carbon Gen 6', 'Core i7-8550U', 16, 512, 'SSD', 14, 69, 'C', 230, 369, 30, 'disponible', 'Subasta Guayaquil', 95],
  ['laptop', 'Dell', 'Latitude 5400', 'Core i5-8365U', 8, 256, 'SSD', 14, 80, 'B', 170, 289, 60, 'revision', 'Lote corporativo Quito', 3],
  ['laptop', 'HP', 'ProBook 450 G7', 'Core i5-10210U', 8, 512, 'SSD', 15.6, 85, 'B', 220, 359, 60, 'disponible', 'Distribuidor Cuenca', 20],
  ['laptop', 'Asus', 'VivoBook 15 X512', 'Core i3-8145U', 8, 256, 'SSD', 15.6, 63, 'C', 120, 219, 30, 'disponible', 'Cliente particular', 110],
  ['desktop', 'Dell', 'OptiPlex 7070 SFF', 'Core i7-9700', 16, 512, 'SSD', null, null, 'A', 230, 379, 90, 'disponible', 'Lote corporativo Quito', 35],
  ['desktop', 'HP', 'ProDesk 600 G4 SFF', 'Core i5-8500', 8, 256, 'SSD', null, null, 'B', 150, 259, 60, 'disponible', 'Distribuidor Cuenca', 50],
  ['desktop', 'Lenovo', 'ThinkCentre M720q Tiny', 'Core i5-8400T', 8, 256, 'SSD', null, null, 'A', 160, 279, 90, 'disponible', 'Lote corporativo Quito', 18],
  ['desktop', 'Dell', 'OptiPlex 3060 Micro', 'Core i3-8100T', 8, 1000, 'HDD', null, null, 'C', 90, 169, 30, 'disponible', 'Subasta Guayaquil', 130],
  ['monitor', 'Dell', 'P2419H', null, null, null, null, 24, null, 'A', 70, 129, 60, 'disponible', 'Lote corporativo Quito', 30],
  ['monitor', 'Dell', 'P2419H', null, null, null, null, 24, null, 'B', 60, 115, 60, 'disponible', 'Lote corporativo Quito', 30],
  ['monitor', 'LG', '24MK430H', null, null, null, null, 24, null, 'B', 50, 95, 30, 'disponible', 'Cliente particular', 45],
  ['monitor', 'Samsung', 'S27R350', null, null, null, null, 27, null, 'A', 85, 155, 60, 'disponible', 'Distribuidor Cuenca', 8],
  ['monitor', 'HP', 'E243', null, null, null, null, 23.8, null, 'C', 45, 89, 30, 'disponible', 'Subasta Guayaquil', 88],
  ['tablet', 'Apple', 'iPad 9.ª generación', null, 3, 64, 'eMMC', 10.2, 89, 'A', 170, 259, 60, 'disponible', 'Cliente particular', 14],
  ['tablet', 'Samsung', 'Galaxy Tab A7', null, 3, 32, 'eMMC', 10.4, 76, 'B', 80, 139, 30, 'revision', 'Cliente particular', 2],
  ['accesorio', 'Dell', 'Dock WD19 (USB-C)', null, null, null, null, null, null, 'A', 60, 109, 30, 'disponible', 'Lote corporativo Quito', 25],
  ['accesorio', 'Logitech', 'Teclado y mouse MK270', null, null, null, null, null, null, 'B', 12, 25, 0, 'disponible', 'Lote corporativo Quito', 70],
  ['accesorio', 'Lenovo', 'Cargador USB-C 65 W', null, null, null, null, null, null, 'A', 10, 22, 30, 'disponible', 'Distribuidor Cuenca', 22],
];

// Equipos que ya se vendieron: [clave, ...mismos campos que arriba sin estado]
const SOLD = {
  e14: ['laptop', 'Lenovo', 'ThinkPad E14', 'Core i5-10210U', 8, 256, 'SSD', 14, 84, 'B', 210, 339, 60, 'Distribuidor Cuenca', 170],
  mbp: ['laptop', 'Apple', 'MacBook Pro 13" (2019)', 'Core i5-8279U', 8, 256, 'SSD', 13.3, 78, 'B', 420, 619, 60, 'Cliente particular', 150],
  t490: ['laptop', 'Lenovo', 'ThinkPad T490', 'Core i5-8265U', 16, 512, 'SSD', 14, 86, 'A', 250, 399, 90, 'Lote corporativo Quito', 140],
  ed800: ['desktop', 'HP', 'EliteDesk 800 G3 Mini', 'Core i5-7500T', 8, 256, 'SSD', null, null, 'B', 110, 199, 60, 'Lote corporativo Quito', 130],
  t24: ['monitor', 'Lenovo', 'ThinkVision T24i-10', null, null, null, null, 23.8, null, 'A', 75, 139, 60, 'Lote corporativo Quito', 100],
  l7400: ['laptop', 'Dell', 'Latitude 7400', 'Core i7-8665U', 16, 512, 'SSD', 14, 90, 'A', 300, 469, 90, 'Lote corporativo Quito', 80],
  o7060: ['desktop', 'Dell', 'OptiPlex 7060 SFF', 'Core i5-8500', 16, 512, 'SSD', null, null, 'B', 170, 289, 60, 'Distribuidor Cuenca', 70],
  u2719: ['monitor', 'Dell', 'UltraSharp U2719D', null, null, null, null, 27, null, 'A', 140, 239, 60, 'Distribuidor Cuenca', 60],
  p24b: ['monitor', 'Dell', 'P2419H', null, null, null, null, 24, null, 'B', 60, 115, 60, 'Lote corporativo Quito', 50],
  air4: ['tablet', 'Apple', 'iPad Air 4', null, 4, 64, 'eMMC', 10.9, 87, 'A', 290, 429, 60, 'Cliente particular', 45],
  hp830: ['laptop', 'HP', 'EliteBook 830 G6', 'Core i5-8365U', 16, 256, 'SSD', 13.3, 83, 'A', 230, 369, 90, 'Lote corporativo Quito', 30],
};

// [días atrás, cliente, pago, descuento, equipos]
const SALES = [
  [160, 'María José Andrade', 'transferencia', 0, ['e14']],
  [120, 'Carlos Vinueza', 'efectivo', 20, ['mbp']],
  [95, 'Estudio Jurídico Paredes', 'tarjeta', 0, ['t490']],
  [70, 'Andrea Salazar', 'transferencia', 10, ['ed800', 't24']],
  [55, 'Diego Guerrero', 'efectivo', 0, ['l7400']],
  [28, 'Consultora Andina', 'transferencia', 25, ['o7060', 'u2719']],
  [18, 'Luis Cárdenas', 'efectivo', 0, ['p24b']],
  [10, 'Gabriela Mora', 'tarjeta', 0, ['air4']],
  [4, 'Paúl Jaramillo', 'transferencia', 15, ['hp830']],
];

function toInput(row, status) {
  const [type, brand, model, cpu, ram_gb, storage_gb, storage_type, screen_in, battery_pct, grade, cost, price, warranty_days] = row;
  return { type, brand, model, cpu, ram_gb, storage_gb, storage_type, screen_in, battery_pct, grade, cost, price, warranty_days, status };
}

function seed() {
  const now = today();
  tx(() => {
    const sold = {};
    for (const [key, row] of Object.entries(SOLD)) {
      const date = addDays(now, -row.at(-1));
      sold[key] = createEquipment({ ...toInput(row, 'disponible'), source: row.at(-2), received_at: date }, { date: now });
    }
    for (const row of ITEMS) {
      createEquipment({ ...toInput(row, row[13]), source: row[14], received_at: addDays(now, -row[15]) }, { date: now });
    }
    for (const [ago, name, payment, discount, keys] of SALES) {
      createSale({ customer: { name }, payment, discount, items: keys.map((k) => sold[k].id) }, { date: addDays(now, -ago) });
    }
  });
}

/** Crea los datos de demostración si la base está vacía. */
export function ensureSeeded() {
  if (get('SELECT 1 FROM equipment LIMIT 1')) return false;
  seed();
  return true;
}

export function resetDemo() {
  tx(() => {
    run('DELETE FROM sale_items');
    run('DELETE FROM sales');
    run('DELETE FROM equipment');
    seed();
  });
}
