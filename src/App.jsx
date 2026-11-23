import { LayoutDashboard, Monitor, Package, Receipt, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import EquipmentDialog from './components/EquipmentDialog.jsx';
import ReceiptDialog from './components/ReceiptDialog.jsx';
import SaleDialog from './components/SaleDialog.jsx';
import { Modal } from './components/ui.jsx';
import { api } from './lib.js';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales from './pages/Sales.jsx';

const TABS = [
  ['resumen', 'Resumen', LayoutDashboard],
  ['inventario', 'Inventario', Package],
  ['ventas', 'Ventas', Receipt],
];

const readTab = () => {
  const tab = window.location.hash.slice(1);
  return TABS.some(([k]) => k === tab) ? tab : 'resumen';
};

export default function App() {
  const [tab, setTab] = useState(readTab);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({ q: '', type: 'todos', status: 'stock' });
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [equipment, sales, summary] = await Promise.all([api('/equipment'), api('/sales'), api('/summary')]);
      setData({ equipment, sales, summary });
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
    const onHash = () => {
      setTab(readTab());
      setDialog(null); // «Atrás» del navegador no debe dejar un diálogo abierto sobre otra sección.
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [reload]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (next, extra) => {
    if (extra) setFilters((f) => ({ ...f, q: '', status: 'stock', ...extra }));
    window.location.hash = next;
    window.scrollTo({ top: 0 });
  };
  const close = () => setDialog(null);
  const notify = (text, kind = 'ok') => setToast({ text, kind });

  const openReceipt = (saleOrNumber) => {
    const sale = typeof saleOrNumber === 'string' ? data.sales.find((s) => s.number === saleOrNumber) : saleOrNumber;
    if (sale) setDialog({ kind: 'receipt', sale });
  };

  async function confirmAction(fn, success) {
    try {
      await fn();
      close();
      notify(success);
      await reload();
    } catch (err) {
      close();
      notify(err.message, 'error');
      await reload();
    }
  }

  const title = TABS.find(([k]) => k === tab)[1];

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div className="topbar-inner">
            <a className="brand" href="#resumen">
              <span className="brand-mark"><Monitor size={18} /></span>
              <span>ReByte <small>Equipos usados</small></span>
            </a>
            <nav className="tabs" aria-label="Secciones">
              {TABS.map(([key, label, Icon]) => (
                <a key={key} href={`#${key}`} className={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="page">
          <div className="page-head">
            <h1>{title}</h1>
            {tab === 'resumen' && (
              <button type="button" className="btn ghost small" onClick={() => setDialog({ kind: 'reset' })}>
                <RotateCcw size={14} /> Reiniciar demo
              </button>
            )}
          </div>

          {loadError && (
            <div className="alert" role="alert">
              {loadError} <button type="button" className="link" onClick={reload}>Reintentar</button>
            </div>
          )}
          {!data && !loadError && <p className="muted">Cargando inventario…</p>}

          {data && tab === 'resumen' && <Dashboard summary={data.summary} onGo={go} onReceipt={openReceipt} />}
          {data && tab === 'inventario' && (
            <Inventory
              equipment={data.equipment}
              filters={filters}
              setFilters={setFilters}
              onNew={() => setDialog({ kind: 'equipment' })}
              onEdit={(equipment) => setDialog({ kind: 'equipment', equipment })}
              onDelete={(equipment) => setDialog({ kind: 'delete', equipment })}
              onSell={(items) => setDialog({ kind: 'sale', items })}
              onReceipt={openReceipt}
            />
          )}
          {data && tab === 'ventas' && (
            <Sales sales={data.sales} onReceipt={openReceipt} onVoid={(sale) => setDialog({ kind: 'void', sale })} />
          )}
        </main>
      </div>

      {dialog?.kind === 'equipment' && (
        <EquipmentDialog
          equipment={dialog.equipment}
          onClose={close}
          onSaved={(e, editing) => {
            close();
            notify(editing ? `${e.code} actualizado.` : `${e.code} ingresado al inventario.`);
            reload();
          }}
        />
      )}
      {dialog?.kind === 'sale' && (
        <SaleDialog
          items={dialog.items}
          onClose={close}
          onSold={(sale) => {
            setDialog({ kind: 'receipt', sale });
            notify(`Venta ${sale.number} registrada.`);
            reload();
          }}
        />
      )}
      {dialog?.kind === 'receipt' && <ReceiptDialog sale={dialog.sale} onClose={close} />}
      {dialog?.kind === 'delete' && (
        <Confirm
          title={`¿Eliminar ${dialog.equipment.code}?`}
          action="Eliminar"
          onClose={close}
          onConfirm={() => confirmAction(() => api(`/equipment/${dialog.equipment.id}`, { method: 'DELETE' }), `${dialog.equipment.code} eliminado.`)}
        >
          Se borrará <strong>{dialog.equipment.brand} {dialog.equipment.model}</strong> del inventario. Esta acción no se puede deshacer.
        </Confirm>
      )}
      {dialog?.kind === 'void' && (
        <Confirm
          title={`¿Anular la venta ${dialog.sale.number}?`}
          action="Anular venta"
          onClose={close}
          onConfirm={() => confirmAction(() => api(`/sales/${dialog.sale.id}/void`, { method: 'POST' }), `Venta ${dialog.sale.number} anulada.`)}
        >
          {dialog.sale.items.length === 1 ? 'El equipo vuelve' : `Los ${dialog.sale.items.length} equipos vuelven`} al inventario como
          «Disponible» y la venta queda en el historial marcada como anulada.
        </Confirm>
      )}
      {dialog?.kind === 'reset' && (
        <Confirm
          title="¿Reiniciar los datos de demostración?"
          action="Reiniciar"
          onClose={close}
          onConfirm={() => confirmAction(() => api('/demo/reset', { method: 'POST' }), 'Datos de demostración restaurados.')}
        >
          Se borran todos los equipos y ventas y se cargan los de ejemplo.
        </Confirm>
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </>
  );
}

function Confirm({ title, action, onClose, onConfirm, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            {busy ? 'Un momento…' : action}
          </button>
        </>
      }
    >
      <p className="confirm-text">{children}</p>
    </Modal>
  );
}
