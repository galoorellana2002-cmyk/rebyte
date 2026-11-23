import express from 'express';
import { location } from './db.js';
import {
  createEquipment,
  createSale,
  deleteEquipment,
  getSale,
  HttpError,
  listEquipment,
  listSales,
  summary,
  updateEquipment,
  voidSale,
} from './store.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: location === ':memory:' ? 'memoria' : 'archivo' });
});

app.get('/api/equipment', (req, res) => res.json(listEquipment()));
app.post('/api/equipment', (req, res) => res.status(201).json(createEquipment(req.body)));
app.put('/api/equipment/:id', (req, res) => res.json(updateEquipment(req.params.id, req.body)));
app.delete('/api/equipment/:id', (req, res) => res.json(deleteEquipment(req.params.id)));

app.get('/api/sales', (req, res) => res.json(listSales()));
app.get('/api/sales/:id', (req, res) => res.json(getSale(req.params.id)));
app.post('/api/sales', (req, res) => res.status(201).json(createSale(req.body)));
app.post('/api/sales/:id/void', (req, res) => res.json(voidSale(req.params.id)));

app.get('/api/summary', (req, res) => res.json(summary()));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});

export default app;
