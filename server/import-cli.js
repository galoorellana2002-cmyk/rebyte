// Uso: npm run import -- "/ruta/Equipos para la venta.xlsx"
import { location } from './db.js';
import { importWorkbook } from './importer.js';

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run import -- "/ruta/al/archivo.xlsx"');
  process.exit(1);
}

try {
  const r = await importWorkbook(file);
  console.log(`Base de datos: ${location}`);
  console.log(`Equipos ingresados: ${r.created.length}${r.created.length ? ` (${r.created.join(', ')})` : ''}`);
  if (r.skipped.length) console.log(`Ya existían, se saltaron: ${r.skipped.length} (${r.skipped.join(', ')})`);
  console.log(`Ventas registradas: ${r.sales.length}`);
  for (const s of r.sales) console.log(`  ${s.number} · ${s.date} · ${s.items.map((i) => i.code).join(', ')} · $${s.total}`);
  for (const w of r.warnings) console.log(`Aviso: ${w}`);
  for (const e of r.errors) console.log(`No se importó: ${e}`);
} catch (err) {
  console.error(`No se pudo importar: ${err.message}`);
  process.exit(1);
}
