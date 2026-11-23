export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.details = data.details;
    throw err;
  }
  return data;
}

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('es-EC', { style: 'percent', maximumFractionDigits: 0 });

export const money = (n) => usd.format(n ?? 0);
export const money0 = (n) => usd0.format(n ?? 0);
export const percent = (n) => pct.format(n ?? 0);

export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-EC', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export const fmtMonth = (ym) => fmtDate(`${ym}-01`, { month: 'short' }).replace('.', '');
