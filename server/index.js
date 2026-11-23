import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';

if (existsSync('.env')) process.loadEnvFile('.env');

const { default: app } = await import('./app.js');
const { location } = await import('./db.js');

// En producción local (npm start) sirve también el frontend compilado.
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// API_PORT tiene prioridad para que el PORT del frontend en desarrollo no la pise.
const port = Number(process.env.API_PORT || process.env.PORT) || 3005;
app.listen(port, () => {
  console.log(`API de ReByte en http://localhost:${port} · base de datos: ${location}`);
});
