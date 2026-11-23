# ReByte · Equipos usados

Inventario pequeño para una tienda que compra y vende equipos de cómputo usados: laptops, desktops, monitores, tablets y accesorios.

## Qué hace

- **Inventario por unidad.** Cada equipo es único: código automático por tipo (`LAP-0001`, `MON-0003`…), especificaciones según el tipo (CPU, RAM, almacenamiento, pantalla, salud de batería), número de serie, condición A/B/C, costo, precio, garantía y origen.
- **Estados.** En revisión → Disponible / Reservado → Vendido. Solo se venden los disponibles o reservados; «vendido» lo pone únicamente una venta.
- **Ventas.** Se seleccionan uno o varios equipos, se registra el cliente (cédula/RUC opcional), la forma de pago y un descuento. Genera un recibo imprimible con la garantía de cada equipo.
- **Anulación.** Una venta anulada queda en el historial y sus equipos vuelven a «Disponible».
- **Resumen.** Stock y dinero invertido, valor a precio de venta, ventas y ganancia del mes, ventas de los últimos 6 meses, stock por tipo y equipos con más de 60 días en bodega.

## Stack

React 19 + Vite · Node.js 24 + Express 5 · SQLite integrado en Node (`node:sqlite`, sin dependencias nativas). Las reglas del negocio (`shared/catalog.js`) se comparten entre el servidor y la interfaz.

## Uso

```bash
npm install
npm run dev      # API en :3005 y web en http://localhost:5177
npm test         # pruebas del dominio y de las ventas
```

La base se crea en `data/rebyte.db` con datos de demostración. En Vercel corre en memoria y se reinicia sola; el botón «Reiniciar demo» restaura los datos de ejemplo.
