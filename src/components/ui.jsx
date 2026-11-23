import { AlertTriangle, CheckCircle2, Clock, Lock, Wrench, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATUSES } from '../../shared/catalog.js';

export function Modal({ title, subtitle, onClose, onSubmit, footer, wide, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    // autoFocus de React corre antes de showModal y el diálogo le quita el foco.
    dialog.querySelector('[data-autofocus]')?.focus();
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
      if (dialog.open) dialog.close();
    };
  }, []);

  const Body = onSubmit ? 'form' : 'div';
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <Body
        className="modal-inner"
        noValidate={onSubmit ? true : undefined}
        onSubmit={
          onSubmit &&
          ((e) => {
            e.preventDefault();
            onSubmit();
          })
        }
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </Body>
    </dialog>
  );
}

const STATUS_ICON = { revision: Wrench, disponible: CheckCircle2, reservado: Clock, vendido: Lock };

export function StatusBadge({ status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`badge st-${status}`}>
      <Icon size={13} aria-hidden="true" />
      {STATUSES[status]}
    </span>
  );
}

export function GradeBadge({ grade }) {
  return <span className={`grade g-${grade}`} title={`Condición ${grade}`}>{grade}</span>;
}

export function StaleBadge({ days }) {
  return (
    <span className="badge st-stale">
      <AlertTriangle size={13} aria-hidden="true" />
      {days} días
    </span>
  );
}

export function Field({ label, error, hint, children, span }) {
  return (
    <label className={`field${error ? ' has-error' : ''}${span ? ` span-${span}` : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Segmented({ value, onChange, options, name }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'on' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
