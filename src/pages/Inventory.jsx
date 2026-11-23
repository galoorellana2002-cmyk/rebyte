import { PackageSearch, Pencil, Plus, Receipt, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { daysBetween, isSellable, margin, specsLine, STALE_DAYS, STATUSES, today, TYPES } from '../../shared/catalog.js';
import { Empty, GradeBadge, StaleBadge, StatusBadge } from '../components/ui.jsx';
import { money, percent } from '../lib.js';

const STATUS_FILTERS = [['stock', 'En stock'], ...Object.entries(STATUSES), ['todos', 'Todos']];

export default function Inventory({ equipment, filters, setFilters, onNew, onEdit, onDelete, onSell, onReceipt }) {
  const { q, type, status } = filters;
  const [selected, setSelected] = useState(() => new Set());
  const now = today();

  // Si un equipo deja de estar a la venta (se vendió, pasó a revisión), sale de la selección.
  useEffect(() => {
    setSelected((prev) => {
      const ok = new Set(equipment.filter((e) => prev.has(e.id) && isSellable(e)).map((e) => e.id));
      return ok.size === prev.size ? prev : ok;
    });
  }, [equipment]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return equipment.filter((e) => {
      if (type !== 'todos' && e.type !== type) return false;
      if (status === 'stock' ? e.status === 'vendido' : status !== 'todos' && e.status !== status) return false;
      if (!needle) return true;
      return [e.code, e.brand, e.model, e.cpu, e.serial, e.source].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [equipment, q, type, status]);

  const sellableRows = rows.filter(isSellable);
  const picked = equipment.filter((e) => selected.has(e.id));
  const allPicked = sellableRows.length > 0 && sellableRows.every((e) => selected.has(e.id));
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of sellableRows) {
        if (allPicked) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
  }

  const totals = rows.reduce((acc, e) => ({ cost: acc.cost + e.cost, price: acc.price + e.price }), { cost: 0, price: 0 });

  return (
    <div className={`stack${picked.length ? ' has-selection' : ''}`}>
      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por código, marca, modelo, CPU o serie"
            value={q}
            onChange={(e) => set('q')(e.target.value)}
            aria-label="Buscar equipos"
          />
        </label>
        <select value={type} onChange={(e) => set('type')(e.target.value)} aria-label="Filtrar por tipo">
          <option value="todos">Todos los tipos</option>
          {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <select value={status} onChange={(e) => set('status')(e.target.value)} aria-label="Filtrar por estado">
          {STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button type="button" className="btn primary" onClick={onNew}>
          <Plus size={16} /> Ingresar equipo
        </button>
      </div>

      {picked.length > 0 && (
        <div className="selection-bar" role="status">
          <span>
            <strong>{picked.length}</strong> {picked.length === 1 ? 'equipo seleccionado' : 'equipos seleccionados'} ·{' '}
            {money(picked.reduce((s, e) => s + e.price, 0))}
          </span>
          <button type="button" className="btn ghost small" onClick={() => setSelected(new Set())}>
            <X size={14} /> Quitar selección
          </button>
          <button type="button" className="btn primary small" onClick={() => onSell(picked)}>
            <ShoppingCart size={14} /> Vender
          </button>
        </div>
      )}

      <section className="card flush">
        {rows.length ? (
          <div className="table-wrap">
            <table className="table inv">
              <thead>
                <tr>
                  <th className="check">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      disabled={!sellableRows.length}
                      onChange={toggleAll}
                      aria-label="Seleccionar todos los equipos a la venta"
                    />
                  </th>
                  <th>Equipo</th>
                  <th>Cond.</th>
                  <th className="num hide-sm">En bodega</th>
                  <th className="num hide-sm">Costo</th>
                  <th className="num">Precio</th>
                  <th className="num hide-sm">Margen</th>
                  <th>Estado</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const days = daysBetween(e.received_at, e.sold_at ?? now);
                  const m = margin(e.cost, e.price);
                  const stale = e.status !== 'vendido' && e.status !== 'revision' && days >= STALE_DAYS;
                  return (
                    <tr key={e.id} className={selected.has(e.id) ? 'picked' : ''}>
                      <td className="check">
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          disabled={!isSellable(e)}
                          onChange={() => toggle(e.id)}
                          aria-label={`Seleccionar ${e.code}`}
                        />
                      </td>
                      <td className="c-eq">
                        <div className="eq">
                          <strong>{e.brand} {e.model}</strong>
                          <span className="muted small">
                            <span className="code">{e.code}</span>
                            {specsLine(e) ? ` · ${specsLine(e)}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="c-grade"><GradeBadge grade={e.grade} /></td>
                      <td className="num hide-sm">{stale ? <StaleBadge days={days} /> : `${days} d`}</td>
                      <td className="num hide-sm">{money(e.cost)}</td>
                      <td className="num strong c-price">{money(e.price)}</td>
                      <td className={`num hide-sm ${m.profit < 0 ? 'neg' : ''}`}>{percent(m.pct)}</td>
                      <td className="c-status">
                        <StatusBadge status={e.status} />
                        {e.sale_number && <span className="muted small block">{e.sale_number}</span>}
                      </td>
                      <td className="actions">
                        {e.status === 'vendido' ? (
                          <button type="button" className="icon-btn" onClick={() => onReceipt(e.sale_number)} aria-label={`Ver recibo de ${e.code}`} title="Ver recibo">
                            <Receipt size={16} />
                          </button>
                        ) : (
                          <>
                            {isSellable(e) && (
                              <button type="button" className="icon-btn" onClick={() => onSell([e])} aria-label={`Vender ${e.code}`} title="Vender">
                                <ShoppingCart size={16} />
                              </button>
                            )}
                            <button type="button" className="icon-btn" onClick={() => onEdit(e)} aria-label={`Editar ${e.code}`} title="Editar">
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="icon-btn danger" onClick={() => onDelete(e)} aria-label={`Eliminar ${e.code}`} title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={PackageSearch} title="No hay equipos con esos filtros">
            Prueba con otra búsqueda o cambia el tipo o el estado.
          </Empty>
        )}
        {rows.length > 0 && (
          <footer className="table-foot small muted">
            {rows.length} {rows.length === 1 ? 'equipo' : 'equipos'} · costo {money(totals.cost)} · precio {money(totals.price)}
          </footer>
        )}
      </section>
    </div>
  );
}
