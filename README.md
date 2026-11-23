# ReByte · Equipos usados

Inventario pequeño para una tienda que compra y vende equipos de cómputo usados: laptops, desktops, monitores, tablets y accesorios.

## Qué hace

- **Inventario por unidad.** Cada equipo es único: código de venta propio (`AIO24`, `LPT1`…) o automático por tipo (`LPT`, `CPU`, `MNT`, `TAB`, `ACC`), especificaciones según el tipo (CPU, RAM, almacenamiento, pantalla, salud de batería), número de serie, condición A/B/C, costo, precio, garantía y origen.
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
npm test         # pruebas del dominio, las ventas y la importación
```

La base vive en `data/rebyte.db` (ignorada por git: los datos reales nunca se suben al repositorio). Empieza vacía.

## Importar el Excel de equipos para la venta

```bash
npm run import -- "/ruta/Equipos para la venta.xlsx"
```

Lee la primera hoja (una fila por equipo, con los encabezados `TIPO`, `MARCA`, `MODELO`, `SERIE`, `COD. VENTA`, `VALOR DE VENTA`, `ESTADO`, `F. REVISION BODEGA`, `RESERVADO POR`, `FECHA RESERVA`, `VENDIDO`…). Los códigos que ya existen se saltan, así que se puede volver a importar el archivo actualizado.

- `ESTADO`: Repotenciado → condición A, Funcional → B, Por repotenciar / De baja / Obsoleto → C.
- `VENDIDO = SI` crea la venta a nombre de `RESERVADO POR` (una por persona y fecha, forma de pago «No registrado»).
- Reservado sin vender queda «Reservado» con el nombre y la fecha en las notas.
- Costo 0 (activos depreciados) y sin garantía; se pueden editar luego.

En Vercel la base corre en memoria y se pierde al reiniciarse: para uso real, córrelo en local (`npm run build && npm start`).
