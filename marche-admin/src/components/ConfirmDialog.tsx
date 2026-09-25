import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'gold' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** Boîte de confirmation modale (Échap / clic hors cadre pour fermer). */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'gold', busy, disabled, error, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('textarea, input, select, button.btn')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        {error ? <p className="err">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost sm" onClick={onClose} disabled={busy}>
            Retour
          </button>
          <button type="button" className={`btn sm ${tone}`} onClick={onConfirm} disabled={busy || disabled}>
            {busy ? 'Envoi…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
