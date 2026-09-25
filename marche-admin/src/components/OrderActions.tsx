import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatFcfa } from '@/lib/api';
import { useLiveSync } from '@/lib/live';
import { useStreamReload } from '@/lib/adminStream';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  DELIVERY_STATUS,
  ORDER_ACTION,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PICK_STATUS,
  ROLE_SHORT,
  formatWhen,
  paymentPillClass,
} from '@/lib/orderLabels';

type Snapshot = {
  status?: string | null;
  pickStatus?: string | null;
  deliveryStatus?: string | null;
  pickerId?: string | null;
  courierId?: string | null;
  paymentStatus?: string | null;
  amount?: number;
  assignedStaffId?: string;
};

type AuditRow = {
  id: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  before: Snapshot | null;
  after: Snapshot | null;
  reason: string | null;
  createdAt: string;
};

type OpsInfo = {
  showMoney: boolean;
  actions: string[];
  state: {
    status: string;
    pickStatus: string | null;
    deliveryStatus: string | null;
    pickerId: string | null;
    courierId: string | null;
    paymentId: string | null;
    paymentStatus: string | null;
    paymentRef: string | null;
    paymentUnverified: boolean;
    skipRef: boolean;
  };
  money: { paid: number; refunded: number; refundable: number; channel: string | null } | null;
  audit: AuditRow[];
  payments: { id: string; providerId: string | null; amount: number | null; method: string; status: string; createdAt: string }[];
  refunds: { id: string; amount: number | null; method: string; channel: string | null; status: string; reason: string; actorName: string | null; createdAt: string }[];
};

type Candidate = {
  id: string;
  name: string;
  role: string;
  vehicle: string | null;
  presence: string;
  lastSeenAt: string | null;
  load: number;
  busyReason: string | null;
};

type DialogKind =
  | 'packed'
  | 'delivered'
  | 'failed'
  | 'redispatch'
  | 'cancel'
  | 'reassign-picker'
  | 'reassign-courier'
  | 'release-picker'
  | 'release-courier'
  | 'refund';

const BUTTONS: { kind: DialogKind; label: string; tone: 'ghost' | 'gold' | 'danger' }[] = [
  { kind: 'reassign-picker', label: 'Réassigner le ramasseur', tone: 'ghost' },
  { kind: 'release-picker', label: 'Libérer le ramasseur', tone: 'ghost' },
  { kind: 'packed', label: 'Marquer rassemblée', tone: 'ghost' },
  { kind: 'reassign-courier', label: 'Réassigner le coursier', tone: 'ghost' },
  { kind: 'release-courier', label: 'Libérer le coursier', tone: 'ghost' },
  { kind: 'delivered', label: 'Marquer livrée', tone: 'gold' },
  { kind: 'failed', label: 'Déclarer un échec', tone: 'danger' },
  { kind: 'redispatch', label: 'Remettre en livraison', tone: 'gold' },
  { kind: 'refund', label: 'Rembourser', tone: 'ghost' },
  { kind: 'cancel', label: 'Annuler la commande', tone: 'danger' },
];

const COPY: Record<DialogKind, { title: string; confirm: string; help: string; reason: 'required' | 'optional' }> = {
  packed: { title: 'Marquer le colis rassemblé ?', confirm: 'Marquer rassemblée', help: 'Force la fin du ramassage (sans contrôle du scan). Le client est notifié.', reason: 'optional' },
  delivered: { title: 'Marquer la commande livrée ?', confirm: 'Marquer livrée', help: 'À utiliser si le coursier n’a pas pu valider le code client. Aucun gain coursier n’est crédité automatiquement.', reason: 'optional' },
  failed: { title: 'Déclarer la livraison en échec ?', confirm: 'Déclarer l’échec', help: 'La course est clôturée en échec, le client et le coursier sont notifiés.', reason: 'required' },
  redispatch: { title: 'Remettre la commande en livraison ?', confirm: 'Remettre en livraison', help: 'La livraison repasse « à pourvoir » pour un autre coursier.', reason: 'required' },
  cancel: { title: 'Annuler la commande ?', confirm: 'Annuler la commande', help: 'Le ramassage et la livraison sont annulés, le stock vendu est réintégré et le client est notifié. Irréversible.', reason: 'required' },
  'reassign-picker': { title: 'Réassigner le ramasseur', confirm: 'Assigner', help: 'Le nouveau ramasseur est notifié ; l’ancien aussi.', reason: 'optional' },
  'reassign-courier': { title: 'Réassigner le coursier', confirm: 'Assigner', help: 'Ajoute la livraison à la tournée du coursier choisi (max 3 colis, tournée non démarrée).', reason: 'optional' },
  'release-picker': { title: 'Libérer le ramasseur ?', confirm: 'Libérer', help: 'Le ramassage retourne dans la file du magasin.', reason: 'optional' },
  'release-courier': { title: 'Libérer le coursier ?', confirm: 'Libérer', help: 'La livraison retourne dans la file « à pourvoir ».', reason: 'optional' },
  refund: { title: 'Enregistrer un remboursement', confirm: 'Enregistrer le remboursement', help: '', reason: 'required' },
};

const PRESENCE_LABEL: Record<string, string> = { online: 'En ligne', paused: 'En pause', offline: 'Hors ligne' };

function snapLine(s: Snapshot | null) {
  if (!s) return '—';
  return [
    ORDER_STATUS[s.status ?? ''] ?? s.status,
    s.pickStatus ? PICK_STATUS[s.pickStatus] ?? s.pickStatus : null,
    s.deliveryStatus ? DELIVERY_STATUS[s.deliveryStatus] ?? s.deliveryStatus : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function OrderActions({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const [info, setInfo] = useState<OpsInfo | null>(null);
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [pick, setPick] = useState('');
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogErr, setDialogErr] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(() => {
    api<OpsInfo>(`/admin/orders/${encodeURIComponent(orderId)}/ops`)
      .then((r) => {
        setInfo(r);
        setErr('');
      })
      .catch((e: Error) => setErr(e.message));
  }, [orderId]);
  useEffect(load, [load]);
  useLiveSync(load, true, 'orders');
  useStreamReload(['payment.'], load);

  const open = (kind: DialogKind) => {
    setDialog(kind);
    setReason('');
    setAmount(kind === 'refund' && info?.money ? String(info.money.refundable) : '');
    setPick('');
    setDialogErr('');
    setCands(null);
    if (kind === 'reassign-picker' || kind === 'reassign-courier') {
      api<{ staff: Candidate[] }>(
        `/admin/orders/${encodeURIComponent(orderId)}/candidates?kind=${kind === 'reassign-picker' ? 'picker' : 'courier'}`,
      )
        .then((r) => setCands(r.staff))
        .catch((e: Error) => setDialogErr(e.message));
    }
  };

  const submit = async () => {
    if (!dialog) return;
    const path =
      dialog === 'packed' || dialog === 'delivered' || dialog === 'failed' || dialog === 'redispatch'
        ? { url: 'status', body: { status: dialog } }
        : dialog === 'release-picker' || dialog === 'release-courier'
          ? { url: 'release', body: { target: dialog === 'release-picker' ? 'picker' : 'courier' } }
          : dialog === 'reassign-picker' || dialog === 'reassign-courier'
            ? { url: dialog, body: { staffId: pick } }
            : dialog === 'refund'
              ? { url: 'refund', body: { amount: amount ? Number(amount) : undefined } }
              : { url: 'cancel', body: {} };
    setBusy(true);
    setDialogErr('');
    try {
      const res = await api<{ refund?: { note: string } }>(`/admin/orders/${encodeURIComponent(orderId)}/${path.url}`, {
        method: 'POST',
        body: JSON.stringify({ ...path.body, reason: reason.trim() || undefined }),
      });
      setFlash(res.refund?.note ?? `${ORDER_ACTION[dialog] ?? dialog} ✓`);
      window.setTimeout(() => setFlash(''), 8000);
      setDialog(null);
      load();
      onChanged();
    } catch (e) {
      setDialogErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = dialog ? COPY[dialog] : null;
  const needsReason = copy?.reason === 'required';
  const needsPick = dialog === 'reassign-picker' || dialog === 'reassign-courier';
  const invalid =
    (needsReason && reason.trim().length < 3) ||
    (needsPick && !pick) ||
    (dialog === 'refund' && info?.money != null && (!(Number(amount) > 0) || Number(amount) > info.money.refundable));
  const buttons = useMemo(() => BUTTONS.filter((b) => info?.actions.includes(b.kind)), [info]);
  const s = info?.state;

  return (
    <>
      <div className="card order-actions" style={{ marginTop: 16 }}>
        <div className="dash-card-head">
          <h3>Actions</h3>
          {s ? (
            <span className={`pill ${paymentPillClass(s.paymentStatus)}`}>
              {PAYMENT_STATUS[s.paymentStatus ?? ''] ?? s.paymentStatus ?? 'Paiement —'}
            </span>
          ) : null}
        </div>
        {err ? <p className="err">{err}</p> : null}
        {s?.paymentUnverified || s?.skipRef ? (
          <p className="warn-note">
            Paiement déclaré par l’app mais <strong>non confirmé</strong>
            {s.paymentRef ? ` (réf. ${s.paymentRef})` : ''} : aucun paiement FedaPay reçu pour cette commande.
          </p>
        ) : null}
        {flash ? <p className="ok-note">{flash}</p> : null}
        {buttons.length ? (
          <div className="action-row">
            {buttons.map((b) => (
              <button key={b.kind} type="button" className={`btn sm ${b.tone}`} onClick={() => open(b.kind)} data-action={b.kind}>
                {b.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="dash-empty">{info ? 'Aucune action possible dans cet état (ou pour votre rôle).' : 'Chargement…'}</p>
        )}
      </div>

      <div className="dash-split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="dash-card-head">
            <h3>Historique des actions</h3>
          </div>
          {info?.audit.length ? (
            <ol className="audit-timeline">
              {info.audit.map((a) => (
                <li key={a.id}>
                  <span className={`audit-dot a-${a.action}`} aria-hidden />
                  <div>
                    <strong>{ORDER_ACTION[a.action] ?? a.action}</strong>
                    {a.after?.amount != null ? <strong> · {formatFcfa(a.after.amount)}</strong> : null}
                    <small>
                      {a.actorName ?? 'Équipe'}
                      {a.actorRole ? ` (${ROLE_SHORT[a.actorRole] ?? a.actorRole})` : ''} · {formatWhen(a.createdAt)}
                    </small>
                    <small>
                      {snapLine(a.before)} → {snapLine(a.after)}
                    </small>
                    {a.reason ? <small className="audit-reason">« {a.reason} »</small> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dash-empty">Aucune action back-office sur cette commande.</p>
          )}
        </div>
        <div className="card">
          <div className="dash-card-head">
            <h3>Paiements & remboursements</h3>
          </div>
          <ul className="dash-list">
            {info?.payments.map((p) => (
              <li key={p.id}>
                <span>
                  FedaPay · {p.method}
                  <small>
                    {p.providerId ? `réf. ${p.providerId}` : 'sans réf. FedaPay'} · {formatWhen(p.createdAt)}
                  </small>
                </span>
                <span>
                  {p.amount != null ? <strong>{formatFcfa(p.amount)} </strong> : null}
                  <span className={`pill ${paymentPillClass(p.status)}`}>{PAYMENT_STATUS[p.status] ?? p.status}</span>
                </span>
              </li>
            ))}
            {info?.refunds.map((r) => (
              <li key={r.id}>
                <span>
                  Remboursement manuel{r.channel === 'cash' ? ' (espèces)' : ' (dashboard FedaPay)'}
                  <small>
                    {r.actorName ?? 'Équipe'} · {formatWhen(r.createdAt)} · « {r.reason} »
                  </small>
                </span>
                <span>
                  {r.amount != null ? <strong>−{formatFcfa(r.amount)} </strong> : null}
                  <span className="pill warn">À exécuter à la main</span>
                </span>
              </li>
            ))}
            {info && !info.payments.length && !info.refunds.length ? (
              <li>
                <span>
                  Aucun paiement en ligne enregistré
                  <small>{s?.paymentId === 'cod' ? 'Paiement à la livraison (espèces).' : 'Pas de transaction FedaPay liée.'}</small>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={copy?.title ?? ''}
        confirmLabel={copy?.confirm ?? 'Confirmer'}
        tone={dialog === 'cancel' || dialog === 'failed' ? 'danger' : 'gold'}
        busy={busy}
        disabled={invalid}
        error={dialogErr}
        onConfirm={() => void submit()}
        onClose={() => setDialog(null)}>
        {copy?.help ? <p className="modal-help">{copy.help}</p> : null}
        {dialog === 'refund' && info?.money ? (
          <>
            <p className="modal-help">
              Payé {formatFcfa(info.money.paid)} · déjà remboursé {formatFcfa(info.money.refunded)}. FedaPay n’offre pas d’API
              de remboursement : le montant est <strong>enregistré ici</strong> et doit être versé à la main
              {info.money.channel === 'cash' ? ' (espèces).' : ' depuis le tableau de bord FedaPay (MTN MoMo).'}
            </p>
            <label className="field">
              <span>Montant (F CFA, max {formatFcfa(info.money.refundable)})</span>
              <input type="number" min={1} max={info.money.refundable} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          </>
        ) : null}
        {needsPick ? (
          <div className="staff-pick" role="listbox" aria-label="Choisir un collaborateur">
            {!cands ? <p className="dash-empty">Chargement de l’équipe…</p> : null}
            {cands && !cands.length ? <p className="dash-empty">Personne d’habilité dans ce magasin.</p> : null}
            {cands?.map((c) => {
              const current = c.id === (dialog === 'reassign-picker' ? s?.pickerId : s?.courierId);
              const off = Boolean(c.busyReason) || current;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={pick === c.id}
                  className={`staff-opt${pick === c.id ? ' on' : ''}`}
                  disabled={off}
                  onClick={() => setPick(c.id)}>
                  <span className={`presence-dot p-${c.presence}`} aria-hidden />
                  <span className="staff-opt-main">
                    <strong>{c.name}</strong>
                    <small>
                      {PRESENCE_LABEL[c.presence] ?? c.presence}
                      {c.lastSeenAt && c.presence !== 'online' ? ` · vu ${formatWhen(c.lastSeenAt)}` : ''}
                      {c.vehicle ? ` · ${c.vehicle}` : ''}
                    </small>
                  </span>
                  <small className="staff-opt-load">
                    {current ? 'Actuel' : c.busyReason ?? (dialog === 'reassign-courier' ? `${c.load}/3 colis` : 'Libre')}
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}
        <label className="field">
          <span>Motif {needsReason ? '(obligatoire)' : '(facultatif)'}</span>
          <textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Visible dans l’historique des actions" />
        </label>
      </ConfirmDialog>
    </>
  );
}
