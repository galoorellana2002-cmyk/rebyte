import { Printer } from 'lucide-react';
import { addDays, GRADES, PAYMENTS, specsLine } from '../../shared/catalog.js';
import { fmtDate, money } from '../lib.js';
import { Modal } from './ui.jsx';

export default function ReceiptDialog({ sale, onClose }) {
  return (
    <Modal
      title={`Recibo ${sale.number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn primary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
        </>
      }
    >
      <article className="receipt">
        {sale.voided_at && <p className="voided-stamp">Venta anulada</p>}
        <header>
          <div>
            <strong className="receipt-brand">ReByte</strong>
            <span className="muted small">Equipos de cómputo usados · Quito</span>
          </div>
          <div className="right">
            <strong>{sale.number}</strong>
            <span className="muted small">{fmtDate(sale.date)}</span>
          </div>
        </header>

        <section className="receipt-customer">
          <span className="muted small">Cliente</span>
          <strong>{sale.customer_name}</strong>
          {(sale.customer_doc || sale.customer_phone) && (
            <span className="small">{[sale.customer_doc, sale.customer_phone].filter(Boolean).join(' · ')}</span>
          )}
        </section>

        <table className="receipt-items">
          <thead>
            <tr><th>Equipo</th><th className="num">Precio</th></tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.brand} {i.model}</strong>
                  <span className="small">{[i.code, specsLine(i)].filter(Boolean).join(' · ')}</span>
                  <span className="small muted">
                    Condición {i.grade} ({GRADES[i.grade].toLowerCase()})
                    {i.serial ? ` · Serie ${i.serial}` : ''}
                    {' · '}
                    {i.warranty_days ? `Garantía hasta ${fmtDate(addDays(sale.date, i.warranty_days))}` : 'Sin garantía'}
                  </span>
                </td>
                <td className="num">{money(i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="totals receipt-totals">
          <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
          {sale.discount > 0 && <div><dt>Descuento</dt><dd>−{money(sale.discount)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd>{money(sale.total)}</dd></div>
          <div><dt>Forma de pago</dt><dd>{PAYMENTS[sale.payment]}</dd></div>
        </dl>

        <p className="muted small receipt-note">
          La garantía cubre fallas de funcionamiento desde la fecha de venta. No cubre golpes, humedad ni daños por mal uso.
          Conserve este recibo.
        </p>
      </article>
    </Modal>
  );
}
