import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PAYMENTS, round2, SALE_PAYMENTS, saleTotals, specsLine } from '../../shared/catalog.js';
import { api, money } from '../lib.js';
import { Field, Modal, Segmented } from './ui.jsx';

export default function SaleDialog({ items: initial, onClose, onSold }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ name: '', doc: '', phone: '', payment: 'efectivo', discount: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
    // El error de un campo desaparece en cuanto se corrige.
    setErrors((prev) => {
      const k = key === 'storage_type' ? 'storage_gb' : key;
      if (!prev[k]) return prev;
      const { [k]: _gone, ...rest } = prev;
      return rest;
    });
  };
  const totals = saleTotals(items.map((i) => i.price), Number(form.discount) || 0);
  const cost = round2(items.reduce((s, i) => s + i.cost, 0));

  async function submit() {
    const local = {};
    if (!form.name.trim()) local.name = 'Escribe el nombre del cliente.';
    if (totals.discount < 0 || totals.discount > totals.subtotal) local.discount = 'Entre 0 y el subtotal.';
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage('Revisa los datos de la venta.');
      return;
    }
    setBusy(true);
    try {
      const sale = await api('/sales', {
        method: 'POST',
        body: {
          customer: { name: form.name, doc: form.doc, phone: form.phone },
          payment: form.payment,
          discount: form.discount,
          items: items.map((i) => i.id),
        },
      });
      onSold(sale);
    } catch (err) {
      setErrors(err.details ?? {});
      setMessage(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title="Registrar venta"
      subtitle={`${items.length} ${items.length === 1 ? 'equipo' : 'equipos'}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {message && <p className="form-msg" role="alert">{message}</p>}
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy || !items.length}>
            {busy ? 'Registrando…' : `Cobrar ${money(totals.total)}`}
          </button>
        </>
      }
    >
      <ul className="sale-lines">
        {items.map((i) => (
          <li key={i.id}>
            <div>
              <strong>{i.brand} {i.model}</strong>
              <span className="muted small">{i.code} · {specsLine(i) || 'Sin especificaciones'}</span>
            </div>
            <span className="num">{money(i.price)}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Quitar ${i.code}`}
              disabled={items.length === 1}
              onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="form-grid">
        <Field label="Cliente" error={errors.name} span={2}>
          <input value={form.name} onChange={set('name')} data-autofocus placeholder="Nombre o razón social" aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Cédula / RUC" error={errors.doc} hint="Opcional">
          <input value={form.doc} onChange={set('doc')} inputMode="numeric" maxLength={13} />
        </Field>
        <Field label="Teléfono" error={errors.phone} hint="Opcional">
          <input value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={20} />
        </Field>
        <Field label="Forma de pago" error={errors.payment} span={2}>
          <Segmented name="Forma de pago" value={form.payment} onChange={set('payment')} options={SALE_PAYMENTS.map((k) => [k, PAYMENTS[k]])} />
        </Field>
        <Field label="Descuento (USD)" error={errors.discount}>
          <input value={form.discount} onChange={set('discount')} inputMode="decimal" placeholder="0.00" aria-invalid={Boolean(errors.discount)} />
        </Field>
        <dl className="totals">
          <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div><dt>Descuento</dt><dd>−{money(totals.discount)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
          <div className="internal"><dt>Ganancia</dt><dd className={totals.total - cost < 0 ? 'neg' : 'pos'}>{money(totals.total - cost)}</dd></div>
        </dl>
      </div>
    </Modal>
  );
}
