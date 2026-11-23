import { Ban, Receipt, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PAYMENTS } from '../../shared/catalog.js';
import { Empty } from '../components/ui.jsx';
import { fmtDate, money } from '../lib.js';

export default function Sales({ sales, onReceipt, onVoid }) {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sales;
    return sales.filter((s) =>
      [s.number, s.customer_name, s.customer_doc, ...s.items.flatMap((i) => [i.code, i.brand, i.model, i.serial])]
        .some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [sales, q]);

  const valid = rows.filter((s) => !s.voided_at);
  const revenue = valid.reduce((sum, s) => sum + s.total, 0);
  const profit = valid.reduce((sum, s) => sum + s.profit, 0);

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por número, cliente, cédula, equipo o serie"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar ventas"
          />
        </label>
        <p className="toolbar-note small">
          <strong>{money(revenue)}</strong> vendidos · <strong className="pos">{money(profit)}</strong> de ganancia
        </p>
      </div>

      <section className="card flush">
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Cliente</th>
                  <th className="hide-sm">Equipos</th>
                  <th className="hide-sm">Pago</th>
                  <th className="num">Total</th>
                  <th className="num hide-sm">Ganancia</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={s.voided_at ? 'voided' : ''}>
                    <td>
                      <strong className="code">{s.number}</strong>
                      <span className="muted small block">{fmtDate(s.date)}</span>
                    </td>
                    <td>
                      {s.customer_name}
                      {s.voided_at && <span className="badge st-voided block-badge"><Ban size={12} /> Anulada</span>}
                    </td>
                    <td className="hide-sm">
                      {s.items.map((i) => (
                        <span className="small block" key={i.id}>{i.brand} {i.model}</span>
                      ))}
                    </td>
                    <td className="hide-sm">{PAYMENTS[s.payment]}</td>
                    <td className="num strong">{money(s.total)}</td>
                    <td className={`num hide-sm ${s.profit < 0 ? 'neg' : ''}`}>{s.voided_at ? '—' : money(s.profit)}</td>
                    <td className="actions">
                      <button type="button" className="icon-btn" onClick={() => onReceipt(s)} aria-label={`Ver recibo ${s.number}`} title="Recibo">
                        <Receipt size={16} />
                      </button>
                      {!s.voided_at && (
                        <button type="button" className="icon-btn danger" onClick={() => onVoid(s)} aria-label={`Anular ${s.number}`} title="Anular">
                          <Ban size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Receipt} title={sales.length ? 'Ninguna venta coincide' : 'Aún no hay ventas'}>
            {sales.length ? 'Prueba con otra búsqueda.' : 'Selecciona equipos en el inventario y pulsa «Vender».'}
          </Empty>
        )}
      </section>
    </div>
  );
}
