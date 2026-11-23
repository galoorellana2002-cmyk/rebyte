import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// SQLite viene incluido en Node (node:sqlite): no hay que instalar ni compilar nada.
// getBuiltinModule evita que el empaquetador de Vercel intente resolverlo como paquete.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    cpu TEXT,
    ram_gb INTEGER,
    storage_gb INTEGER,
    storage_type TEXT,
    screen_in REAL,
    battery_pct INTEGER,
    serial TEXT,
    grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C')),
    cost REAL NOT NULL CHECK (cost >= 0),
    price REAL NOT NULL CHECK (price > 0),
    warranty_days INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('revision', 'disponible', 'reservado', 'vendido')),
    source TEXT,
    notes TEXT,
    received_at TEXT NOT NULL,
    sold_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_doc TEXT,
    customer_phone TEXT,
    payment TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL,
    total REAL NOT NULL,
    voided_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    price REAL NOT NULL,
    cost REAL NOT NULL,
    PRIMARY KEY (sale_id, equipment_id)
  );
`;

function resolveLocation() {
  if (process.env.DB_FILE) return process.env.DB_FILE;
  // En Vercel el disco es de solo lectura: ahí la base vive en memoria y se pierde al reiniciarse.
  if (process.env.VERCEL) return ':memory:';
  const dir = path.resolve('data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, 'rebyte.db');
}

export const location = resolveLocation();
export const db = new DatabaseSync(location);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(SCHEMA);

const cache = new Map();
function statement(sql) {
  let st = cache.get(sql);
  if (!st) {
    st = db.prepare(sql);
    cache.set(sql, st);
  }
  return st;
}

export const all = (sql, ...params) => statement(sql).all(...params);
export const get = (sql, ...params) => statement(sql).get(...params);
export const run = (sql, ...params) => statement(sql).run(...params);

let depth = 0;
/** Ejecuta fn dentro de una transacción (anidable). */
export function tx(fn) {
  if (depth > 0) return fn();
  depth++;
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    depth--;
  }
}
