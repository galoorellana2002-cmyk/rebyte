import { AlertTriangle, ArrowRight, Receipt } from 'lucide-react';
import { specsLine, STALE_DAYS } from '../../shared/catalog.js';
import { Empty, StaleBadge } from '../components/ui.jsx';
import { fmtDate, fmtMonth, money, money0 } from '../lib.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function Dashboard({ summary, onGo, onReceipt }) {
  const { stock, byStatus, byType, month, months, stale, avgDaysToSell, recentSales } = summary;
  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1);
  const maxTypeValue = Math.max(...byType.map((t) => t.price), 1);
  const monthName = fmtDate(`${month.month}-01`, { month: 'long' });

  return (
    <div className="stack-lg">
      <section className="kpis" aria-label="Indicadores">
        <article className="kpi">
          <span className="kpi-label">Equipos en stock</span>
          <strong className="kpi-value">{stock.count}</strong>
          <span className="kpi-sub">
            {plural(byStatus.disponible, 'disponible', 'disponibles')} · {plural(byStatus.reservado, 'reservado', 'reservados')} ·{' '}
            {byStatus.revision} en revisión
          </span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Invertido en stock</span>
          <strong className="kpi-value">{money0(stock.cost)}</strong>
          <span className="kpi-sub">Costo de compra de lo que no se ha vendido</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Valor a precio de venta</span>
          <strong className="kpi-value">{money0(stock.price)}</strong>
          <span className="kpi-sub pos">+{money0(stock.profit)} de ganancia si se vende todo</span>
        </article>
        <article className="kpi accent">
          <span className="kpi-label">Ventas de {monthName}</span>
          <strong className="kpi-value">{money0(month.revenue)}</strong>
          <span className="kpi-sub">
            {month.count} {month.count === 1 ? 'venta' : 'ventas'} · ganancia {money0(month.profit)}
          </span>
        </article>
      </section>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>Ventas de los últimos 6 meses</h2>
            {avgDaysToSell != null && <span className="muted small">Un equipo tarda {avgDaysToSell} días en venderse (prom. 90 días)</span>}
          </header>
          <div className="bars" role="img" aria-label={months.map((m) => `${fmtMonth(m.month)}: ${money0(m.revenue)}`).join(', ')}>
            {months.map((m) => (
              <div className="bar-col" key={m.month}>
                <span className="bar-value">{m.revenue ? money0(m.revenue) : ''}</span>
                <div className="bar-track">
                  <div className="bar" style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}>
                    <div className="bar-profit" style={{ height: `${m.revenue ? (m.profit / m.revenue) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="bar-label">{fmtMonth(m.month)}</span>
              </div>
            ))}
          </div>
          <p className="legend small">
            <span className="dot rev" /> Ingresos <span className="dot pro" /> Ganancia
          </p>
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Stock por tipo</h2>
            <span className="muted small">Valor a precio de venta</span>
          </header>
          <ul className="type-list">
            {byType.map((t) => (
              <li key={t.type}>
                <button type="button" className="type-row" onClick={() => onGo('inventario', { type: t.type })}>
                  <span className="type-name">{t.label}</span>
                  <span className="type-count">{t.count}</span>
                  <span className="type-bar"><i style={{ width: `${(t.price / maxTypeValue) * 100}%` }} /></span>
                  <span className="num">{money0(t.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header className="card-head">
            <h2>
              <AlertTriangle size={18} className="warn-icon" aria-hidden="true" /> Más de {STALE_DAYS} días en bodega
            </h2>
            <span className="muted small">Candidatos a rebaja o combo</span>
          </header>
          {stale.length ? (
            <ul className="list">
              {stale.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <div>
                    <strong>{e.brand} {e.model}</strong>
                    <span className="muted small">{e.code} · {specsLine(e) || 'Accesorio'}</span>
                  </div>
                  <StaleBadge days={e.days} />
                  <span className="num">{money(e.price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nada estancado">Todo el stock tiene menos de {STALE_DAYS} días.</Empty>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h2>Últimas ventas</h2>
            <button type="button" className="link" onClick={() => onGo('ventas')}>
              Ver todas <ArrowRight size={14} />
            </button>
          </header>
          {recentSales.length ? (
            <ul className="list">
              {recentSales.map((s) => (
                <li key={s.id}>
                  <button type="button" className="list-btn" onClick={() => onReceipt(s)}>
                    <div>
                      <strong>{s.customer_name}</strong>
                      <span className="muted small">
                        {s.number} · {fmtDate(s.date)} · {s.items.map((i) => i.model).join(', ')}
                      </span>
                    </div>
                    <span className="num">{money(s.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Receipt} title="Aún no hay ventas" />
          )}
        </section>
      </div>
    </div>
  );
}
