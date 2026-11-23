import { useState } from 'react';
import {
  EDITABLE_STATUSES,
  GRADES,
  margin,
  STATUSES,
  STORAGE_TYPES,
  today,
  TYPES,
  validateEquipment,
} from '../../shared/catalog.js';
import { api, money, percent } from '../lib.js';
import { Field, Modal, Segmented } from './ui.jsx';

const EMPTY = {
  type: 'laptop', brand: '', model: '', cpu: '', ram_gb: '', storage_gb: '', storage_type: 'SSD', screen_in: '',
  battery_pct: '', serial: '', grade: 'B', status: 'disponible', cost: '', price: '', warranty_days: '30',
  received_at: '', source: '', notes: '',
};

function toForm(e) {
  if (!e) return { ...EMPTY, received_at: today() };
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, e[k] == null ? '' : String(e[k])]));
}

export default function EquipmentDialog({ equipment, onClose, onSaved }) {
  const editing = Boolean(equipment);
  const [form, setForm] = useState(() => toForm(equipment));
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
  const fields = TYPES[form.type]?.fields ?? [];
  const has = (f) => fields.includes(f);

  const cost = Number(form.cost);
  const price = Number(form.price);
  const preview = form.cost !== '' && form.price !== '' && price > 0 ? margin(cost, price) : null;

  async function submit() {
    const check = validateEquipment(form);
    if (!check.ok) {
      setErrors(check.errors);
      setMessage('Revisa los campos marcados.');
      return;
    }
    setBusy(true);
    try {
      const saved = await api(editing ? `/equipment/${equipment.id}` : '/equipment', {
        method: editing ? 'PUT' : 'POST',
        body: form,
      });
      onSaved(saved, editing);
    } catch (err) {
      setErrors(err.details ?? {});
      setMessage(err.message);
      setBusy(false);
    }
  }

  const input = (key, props = {}) => <input value={form[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />;

  return (
    <Modal
      wide
      title={editing ? `Editar ${equipment.code}` : 'Ingresar equipo'}
      subtitle={editing ? `${equipment.brand} ${equipment.model}` : 'El código se asigna solo según el tipo.'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {message && <p className="form-msg" role="alert">{message}</p>}
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Ingresar al inventario'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Tipo" error={errors.type} span={4}>
          <Segmented name="Tipo" value={form.type} onChange={set('type')} options={Object.entries(TYPES).map(([k, t]) => [k, t.label])} />
        </Field>
        <Field label="Marca" error={errors.brand} span={2}>{input('brand', { placeholder: 'Lenovo', 'data-autofocus': !editing || undefined })}</Field>
        <Field label="Modelo" error={errors.model} span={2}>{input('model', { placeholder: 'ThinkPad T480' })}</Field>

        {has('cpu') && <Field label="Procesador" error={errors.cpu} span={2}>{input('cpu', { placeholder: 'Core i5-8350U' })}</Field>}
        {has('ram_gb') && (
          <Field label="RAM (GB)" error={errors.ram_gb}>{input('ram_gb', { inputMode: 'numeric', placeholder: '16' })}</Field>
        )}
        {has('storage') && (
          <Field label="Almacenamiento (GB)" error={errors.storage_gb || errors.storage_type}>
            <div className="joined">
              {input('storage_gb', { inputMode: 'numeric', placeholder: '256' })}
              <select value={form.storage_type} onChange={set('storage_type')} aria-label="Tipo de almacenamiento">
                {STORAGE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </Field>
        )}
        {has('screen_in') && (
          <Field label="Pantalla (pulgadas)" error={errors.screen_in}>{input('screen_in', { inputMode: 'decimal', placeholder: '14' })}</Field>
        )}
        {has('battery_pct') && (
          <Field label="Salud de batería (%)" error={errors.battery_pct}>{input('battery_pct', { inputMode: 'numeric', placeholder: '85' })}</Field>
        )}
        <Field label="N.º de serie" error={errors.serial} hint="Opcional" span={has('battery_pct') ? 1 : 2}>{input('serial')}</Field>

        <Field label="Condición" error={errors.grade} span={2}>
          <Segmented name="Condición" value={form.grade} onChange={set('grade')} options={Object.entries(GRADES).map(([k, l]) => [k, `${k} · ${l}`])} />
        </Field>
        <Field label="Estado" error={errors.status} span={2}>
          <Segmented name="Estado" value={form.status} onChange={set('status')} options={EDITABLE_STATUSES.map((s) => [s, STATUSES[s]])} />
        </Field>

        <Field label="Costo de compra (USD)" error={errors.cost}>{input('cost', { inputMode: 'decimal', placeholder: '0.00' })}</Field>
        <Field label="Precio de venta (USD)" error={errors.price}>{input('price', { inputMode: 'decimal', placeholder: '0.00' })}</Field>
        <Field label="Garantía (días)" error={errors.warranty_days}>{input('warranty_days', { inputMode: 'numeric' })}</Field>
        <div className={`margin-box${preview && preview.profit < 0 ? ' neg' : ''}`} aria-live="polite">
          <span className="field-label">Ganancia esperada</span>
          {preview ? (
            <strong>{money(preview.profit)} <small>({percent(preview.pct)})</small></strong>
          ) : (
            <span className="muted">Escribe costo y precio</span>
          )}
        </div>

        <Field label="Fecha de ingreso" error={errors.received_at}>{input('received_at', { type: 'date', max: today() })}</Field>
        <Field label="Origen / proveedor" error={errors.source} hint="Opcional" span={3}>
          {input('source', { placeholder: 'Lote corporativo, cliente particular…' })}
        </Field>
        <Field label="Notas" error={errors.notes} hint="Detalles estéticos, piezas cambiadas, accesorios incluidos…" span={4}>
          <textarea rows={2} value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
