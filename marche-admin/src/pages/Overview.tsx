import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Warehouse,
  Tags,
  Users,
  UserPlus,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Plus,
  ArrowUpDown,
} from 'lucide-react';
import { api, formatFcfa } from '@/lib/api';
import { useAppSelector } from '@/app/hooks';
import { ONBOARD_LABELS, roleLabel } from '@/lib/staffLabels';
import { BarChart, DonutChart, Kpi, LineChart, dayLabel, deltaPct, money, monthLabel } from '@/components/Charts';
import { ORDER_STATUS, formatWhen, orderPillClass } from '@/lib/orderLabels';

type Stats = {
  products: number;
  outOfStock: number;
  alerts: number;
  promotions: number;
  categories?: number;
  ordersToday?: number;
  ordersOpen?: number;
  pickQueue?: number;
  pickLive?: number;
  deliverLive?: number;
  ordersYesterday?: number;
  revenueToday?: number | null;
  revenueYesterday?: number | null;
  revenue7d?: number | null;
  revenue30d?: number | null;
  revenueMonth?: number | null;
  avgBasket?: number | null;
  delivered30d?: number;
  failed30d?: number;
};

type DayPoint = {
  date: string;
  orders: number;
  revenue: number;
  delivered: number;
  failed: number;
  packed: number;
};
type MonthPoint = { date: string; orders: number; revenue: number; delivered: number };
type StatSlice = { label: string; n: number; amount?: number | null };
type TopProduct = { productId: string; name: string; qty: number; revenue: number | null };
type RecentOrder = {
  id: string;
  status: string;
  total: number | null;
  subtotal?: number | null;
  deliveryFee?: number | null;
  pickFee?: number | null;
  itemCount: number;
  storeName: string | null;
  customerName: string;
  createdAt: string;
  missingCount?: number;
  incidentCount?: number;
  deliveryStatus?: string | null;
};
type Inventory = {
  physical: number;
  reserved: number;
  available: number;
  soldToday: number;
  sold30d: number;
  received30d: number;
  shrink30d: number;
};
type StockTracking = {
  productId: string;
  name: string;
  initialQty: number;
  sold: number;
  received: number;
  adjusted: number;
  reserved: number;
  remaining: number;
};

type AlertItem = { productId: string; name: string; available: number; minQty: number };
type Rupture = { id: string; name: string };
type Recent = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  onboardStatus: string;
  isActive: boolean;
  createdAt: string;
};
type HrOverview = {
  counts: { onboardStatus: string; isActive: boolean; n: number }[];
  byRole: { role: string; n: number }[];
  suspended?: number;
  recent?: Recent[];
  series?: { days: { date: string; n: number }[]; months: { date: string; n: number }[] };
};

export function OverviewPage() {
  const staff = useAppSelector((s) => s.auth.staff);
  const catalog = Boolean(staff?.canEditStock);
  const hrAccess = Boolean(staff?.canHr || staff?.canReadHr);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [ruptures, setRuptures] = useState<Rupture[]>([]);
  const [hr, setHr] = useState<HrOverview | null>(null);
  const [seriesDays, setSeriesDays] = useState<DayPoint[]>([]);
  const [seriesMonths, setSeriesMonths] = useState<MonthPoint[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<StatSlice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<StatSlice[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [stockTracking, setStockTracking] = useState<StockTracking[]>([]);
  const [showMoney, setShowMoney] = useState(false);
  const [range, setRange] = useState<'7d' | '30d' | '12m'>('30d');
  const [hrRange, setHrRange] = useState<'30d' | '12m'>('30d');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (catalog) {
      api<{
        stats: Stats;
        showMoney?: boolean;
        series?: { days: DayPoint[]; months: MonthPoint[] };
        breakdowns?: { orderStatuses: StatSlice[]; paymentMethods: StatSlice[] };
        topProducts?: TopProduct[];
        recentOrders?: RecentOrder[];
        inventory?: Inventory;
        stockTracking?: StockTracking[];
        alertItems?: AlertItem[];
        ruptures?: Rupture[];
      }>('/admin/overview')
        .then((r) => {
          setStats(r.stats);
          setShowMoney(Boolean(r.showMoney));
          setAlerts(r.alertItems ?? []);
          setRuptures(r.ruptures ?? []);
          setSeriesDays(r.series?.days ?? []);
          setSeriesMonths(r.series?.months ?? []);
          setOrderStatuses(r.breakdowns?.orderStatuses ?? []);
          setPaymentMethods(r.breakdowns?.paymentMethods ?? []);
          setTopProducts(r.topProducts ?? []);
          setRecentOrders(r.recentOrders ?? []);
          setInventory(r.inventory ?? null);
          setStockTracking(r.stockTracking ?? []);
        })
        .catch((e: Error) => setErr(e.message));
    }
    if (hrAccess) {
      api<HrOverview>('/admin/staff/overview')
        .then(setHr)
        .catch((e: Error) => {
          if (!catalog) setErr(e.message);
        });
    }
  }, [catalog, hrAccess]);

  const active = hr?.counts.filter((c) => c.isActive).reduce((a, c) => a + c.n, 0) ?? 0;
  const pipeline =
    hr?.counts.filter((c) => c.onboardStatus === 'draft' || c.onboardStatus === 'invited').reduce((a, c) => a + c.n, 0) ??
    0;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const success =
    (stats?.delivered30d ?? 0) + (stats?.failed30d ?? 0) > 0
      ? Math.round(((stats?.delivered30d ?? 0) / ((stats?.delivered30d ?? 0) + (stats?.failed30d ?? 0))) * 100)
      : null;

  const daySlice = useMemo(() => (range === '7d' ? seriesDays.slice(-7) : seriesDays), [range, seriesDays]);
  const orderBars = useMemo(
    () =>
      range === '12m'
        ? seriesMonths.map((p) => ({ label: monthLabel(p.date), value: p.orders }))
        : daySlice.map((p) => ({ label: dayLabel(p.date), value: p.orders })),
    [range, seriesMonths, daySlice],
  );
  const revenueLine = useMemo(
    () =>
      range === '12m'
        ? seriesMonths.map((p) => ({ label: monthLabel(p.date), value: p.revenue }))
        : daySlice.map((p) => ({ label: dayLabel(p.date), value: p.revenue })),
    [range, seriesMonths, daySlice],
  );
  const opsBars = useMemo(
    () =>
      range === '12m'
        ? seriesMonths.map((p) => ({ label: monthLabel(p.date), value: p.delivered }))
        : daySlice.map((p) => ({ label: dayLabel(p.date), value: p.delivered })),
    [range, seriesMonths, daySlice],
  );
  const hireBars = useMemo(() => {
    if (hrRange === '12m') {
      return (hr?.series?.months ?? []).map((p) => ({ label: monthLabel(p.date), value: p.n }));
    }
    return (hr?.series?.days ?? []).map((p) => ({ label: dayLabel(p.date), value: p.n }));
  }, [hr, hrRange]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>
            {hello}, {staff?.firstName}
          </h2>
          <p>
            {catalog && hrAccess
              ? 'Magasin, CourseGO et équipe — tout ce qui bouge aujourd’hui.'
              : catalog
                ? 'Catalogue, stock et commandes du Super U.'
                : 'Personnel, recrutement et rôles — jamais les clients boutique.'}
          </p>
        </div>
        {catalog ? (
          <Link className="btn gold" to="/produits">
            Ouvrir le catalogue
          </Link>
        ) : (
          <Link className="btn gold" to="/personnel/nouveau">
            Nouveau collaborateur
          </Link>
        )}
      </div>
      {err ? <p className="err">{err}</p> : null}

      <div className="quick-actions">
        <span className="quick-label">Actions rapides</span>
        {catalog && staff?.canCreateProducts ? (
          <Link to="/produits/nouveau" className="quick-action">
            <Plus size={18} />
            <span>
              <strong>Ajouter un produit</strong>
              <small>Créer une nouvelle référence</small>
            </span>
          </Link>
        ) : null}
        {catalog ? (
          <Link to="/stock" className="quick-action">
            <ArrowUpDown size={18} />
            <span>
              <strong>Enregistrer un mouvement</strong>
              <small>Entrée, sortie ou transfert</small>
            </span>
          </Link>
        ) : null}
        {hrAccess && staff?.canHr ? (
          <Link to="/personnel/nouveau" className="quick-action">
            <UserPlus size={18} />
            <span>
              <strong>Créer un collaborateur</strong>
              <small>Démarrer son onboarding</small>
            </span>
          </Link>
        ) : null}
      </div>

      {catalog && stats ? (
        <>
          <h3 className="dash-h">Indicateurs</h3>
          <div className="grid stats">
            <Kpi
              label="Commandes du jour"
              value={String(stats.ordersToday ?? 0)}
              delta={deltaPct(stats.ordersToday ?? 0, stats.ordersYesterday ?? 0)}
            />
            {showMoney ? (
              <Kpi
                label="Encaissé aujourd’hui"
                value={money(stats.revenueToday)}
                delta={deltaPct(stats.revenueToday ?? 0, stats.revenueYesterday ?? 0)}
              />
            ) : null}
            {showMoney ? (
              <Kpi label="CA 7 jours" value={money(stats.revenue7d)} hint="Somme des lignes commandées" />
            ) : null}
            {showMoney ? (
              <Kpi label="CA du mois" value={money(stats.revenueMonth)} hint="Depuis le 1er du mois" />
            ) : null}
            {showMoney ? (
              <Kpi label="Panier moyen 30 j" value={money(stats.avgBasket)} />
            ) : null}
            <Kpi label="Commandes ouvertes" value={String(stats.ordersOpen ?? 0)} />
            <Kpi
              label="Livraisons 30 j"
              value={String(stats.delivered30d ?? 0)}
              hint={success != null ? `${success} % abouties` : undefined}
            />
            <Kpi label="Échecs 30 j" value={String(stats.failed30d ?? 0)} />
          </div>

          <div className="chart-head">
            <h3 className="dash-h" style={{ margin: 0 }}>
              Activité {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '12 mois'}
            </h3>
            <div className="seg">
              {(['7d', '30d', '12m'] as const).map((r) => (
                <button key={r} type="button" className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                  {r === '7d' ? '7 jours' : r === '30d' ? '30 jours' : '12 mois'}
                </button>
              ))}
            </div>
          </div>
          <div className="dash-split charts">
            <div className="card">
              <div className="dash-card-head">
                <h3>Commandes</h3>
              </div>
              <BarChart points={orderBars} />
            </div>
            {showMoney ? (
              <div className="card">
                <div className="dash-card-head">
                  <h3>Chiffre d’affaires</h3>
                </div>
                <LineChart points={revenueLine} format={formatFcfa} />
              </div>
            ) : null}
            <div className="card">
              <div className="dash-card-head">
                <h3>Livraisons abouties</h3>
              </div>
              <BarChart points={opsBars} />
            </div>
          </div>

          <h3 className="dash-h">Aujourd’hui en magasin</h3>
          <div className="grid stats">
            <div className="card stat">
              <div className="k">Commandes du jour</div>
              <div className="v">{stats.ordersToday ?? 0}</div>
            </div>
            <div className="card stat">
              <div className="k">En cours</div>
              <div className="v">{stats.ordersOpen ?? 0}</div>
            </div>
            <div className="card stat">
              <div className="k">File ramassage</div>
              <div className="v">{stats.pickQueue ?? 0}</div>
            </div>
            <div className="card stat">
              <div className="k">Livraisons live</div>
              <div className="v">{stats.deliverLive ?? 0}</div>
            </div>
          </div>
          <h3 className="dash-h">Catalogue & stock</h3>
          <div className="grid stats">
            <div className="card stat">
              <div className="k">Références</div>
              <div className="v">{stats.products}</div>
            </div>
            <div className="card stat">
              <div className="k">Rayons</div>
              <div className="v">{stats.categories ?? '—'}</div>
            </div>
            <div className="card stat">
              <div className="k">Ruptures</div>
              <div className="v">{stats.outOfStock}</div>
            </div>
            <div className="card stat">
              <div className="k">Alertes seuil</div>
              <div className="v">{stats.alerts}</div>
            </div>
            <div className="card stat">
              <div className="k">En promotion</div>
              <div className="v">{stats.promotions}</div>
            </div>
            <div className="card stat">
              <div className="k">Ramassages en cours</div>
              <div className="v">{stats.pickLive ?? 0}</div>
            </div>
          </div>
          {inventory ? (
            <>
              <h3 className="dash-h">Suivi des quantités</h3>
              <div className="grid stats">
                <Kpi label="Stock physique" value={inventory.physical.toLocaleString('fr-FR')} hint="Toutes les unités en magasin" />
                <Kpi label="Réservé" value={inventory.reserved.toLocaleString('fr-FR')} hint="Commandes pas encore finalisées" />
                <Kpi label="Disponible" value={inventory.available.toLocaleString('fr-FR')} hint="Physique moins réservé" />
                <Kpi label="Vendu aujourd’hui" value={inventory.soldToday.toLocaleString('fr-FR')} />
                <Kpi label="Vendu sur 30 jours" value={inventory.sold30d.toLocaleString('fr-FR')} />
                <Kpi label="Reçu sur 30 jours" value={inventory.received30d.toLocaleString('fr-FR')} />
                <Kpi label="Pertes sur 30 jours" value={inventory.shrink30d.toLocaleString('fr-FR')} />
              </div>
              <div className="card" style={{ marginTop: 14, overflowX: 'auto' }}>
                <div className="dash-card-head">
                  <Warehouse size={16} />
                  <h3>Stock initial → restant (30 jours)</h3>
                  <Link to="/stock">Gérer le stock</Link>
                </div>
                <table className="stock-follow">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Initial</th>
                      <th>Entrées</th>
                      <th>Acheté</th>
                      <th>Réservé</th>
                      <th>Restant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockTracking.map((p) => (
                      <tr key={p.productId}>
                        <td>
                          <Link to={`/produits/${p.productId}`}>{p.name}</Link>
                        </td>
                        <td>{p.initialQty.toLocaleString('fr-FR')}</td>
                        <td className="stock-in">+{p.received.toLocaleString('fr-FR')}</td>
                        <td className="stock-out">−{p.sold.toLocaleString('fr-FR')}</td>
                        <td>{p.reserved.toLocaleString('fr-FR')}</td>
                        <td>
                          <strong>{p.remaining.toLocaleString('fr-FR')}</strong>
                        </td>
                      </tr>
                    ))}
                    {!stockTracking.length ? (
                      <tr>
                        <td colSpan={6} className="dash-empty">
                          Aucun mouvement de vente ou réception sur cette période.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {hr ? (
        <>
          <h3 className="dash-h">Personnel</h3>
          <div className="grid stats">
            <div className="card stat">
              <div className="k">Comptes actifs</div>
              <div className="v">{active}</div>
            </div>
            <div className="card stat">
              <div className="k">File recrutement</div>
              <div className="v">{pipeline}</div>
            </div>
            <div className="card stat">
              <div className="k">Suspendus</div>
              <div className="v">{hr.suspended ?? 0}</div>
            </div>
            {(hr.byRole ?? []).slice(0, 5).map((r) => (
              <div key={r.role} className="card stat">
                <div className="k">{roleLabel(r.role)}</div>
                <div className="v">{r.n}</div>
              </div>
            ))}
          </div>
          {hireBars.length ? (
            <>
              <div className="chart-head">
                <h3 className="dash-h" style={{ margin: 0 }}>
                  Embauches
                </h3>
                <div className="seg">
                  <button type="button" className={hrRange === '30d' ? 'on' : ''} onClick={() => setHrRange('30d')}>
                    30 jours
                  </button>
                  <button type="button" className={hrRange === '12m' ? 'on' : ''} onClick={() => setHrRange('12m')}>
                    12 mois
                  </button>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 16 }}>
                <BarChart points={hireBars} />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {catalog ? (
        <>
          <h3 className="dash-h">Analyse des 30 derniers jours</h3>
          <div className="dash-split">
            <div className="card">
              <div className="dash-card-head">
                <ShoppingBag size={16} />
                <h3>Statuts des commandes</h3>
              </div>
              <DonutChart
                points={orderStatuses.map((s) => ({
                  label: ORDER_STATUS[s.label] ?? s.label,
                  value: s.n,
                }))}
              />
            </div>
            <div className="card">
              <div className="dash-card-head">
                <Tags size={16} />
                <h3>Moyens de paiement</h3>
              </div>
              <ul className="dash-list">
                {paymentMethods.map((p) => (
                  <li key={p.label}>
                    <span>{p.label}</span>
                    <span>
                      <strong>{p.n}</strong>
                      {showMoney && p.amount != null ? <small>{formatFcfa(p.amount)}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="dash-card-head">
                <Package size={16} />
                <h3>Produits les plus commandés</h3>
                <Link to="/produits">Catalogue</Link>
              </div>
              <ul className="dash-list">
                {topProducts.map((p) => (
                  <li key={p.productId}>
                    <Link to={`/produits/${p.productId}`}>{p.name}</Link>
                    <span>
                      <strong>{p.qty} unités</strong>
                      {showMoney && p.revenue != null ? <small>{formatFcfa(p.revenue)}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="dash-card-head">
                <Truck size={16} />
                <h3>Commandes récentes</h3>
                <Link to="/commandes">Toutes</Link>
              </div>
              <ul className="dash-list">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/commandes/${encodeURIComponent(o.id)}`}>
                      <strong>{o.customerName}</strong>
                      <small>
                        {o.itemCount} article{o.itemCount > 1 ? 's' : ''} · {formatWhen(o.createdAt)}
                        {o.missingCount ? ` · ${o.missingCount} manque${o.missingCount > 1 ? 's' : ''}` : ''}
                        {o.incidentCount ? ` · ${o.incidentCount} litige${o.incidentCount > 1 ? 's' : ''}` : ''}
                      </small>
                    </Link>
                    <span>
                      <span className={`pill ${orderPillClass(o.status, o.deliveryStatus)}`}>
                        {o.deliveryStatus === 'failed' ? 'Échouée' : ORDER_STATUS[o.status] ?? o.status}
                      </span>
                      {showMoney && o.total != null ? <small>{formatFcfa(o.total)}</small> : null}
                      {showMoney && (o.subtotal != null || o.pickFee != null || o.deliveryFee != null) ? (
                        <small>
                          Panier {o.subtotal != null ? formatFcfa(o.subtotal) : '—'} · Ram. {o.pickFee != null ? formatFcfa(o.pickFee) : '—'} · Liv. {o.deliveryFee != null ? formatFcfa(o.deliveryFee) : '—'}
                        </small>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}

      <div className="dash-split">
        {catalog ? (
          <div className="card">
            <div className="dash-card-head">
              <AlertTriangle size={16} />
              <h3>À réapprovisionner</h3>
              <Link to="/stock">Voir le stock</Link>
            </div>
            {alerts.length ? (
              <ul className="dash-list">
                {alerts.map((a) => (
                  <li key={a.productId}>
                    <span>{a.name}</span>
                    <span className="pill out">
                      {a.available} / min {a.minQty}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-empty">Aucun seuil dépassé sur ce magasin.</p>
            )}
            {ruptures.length ? (
              <>
                <p className="dash-sub">Ruptures boutique</p>
                <ul className="dash-list">
                  {ruptures.map((r) => (
                    <li key={r.id}>
                      <Link to={`/produits/${r.id}`}>{r.name}</Link>
                      <span className="pill out">Rupture</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {hrAccess ? (
          <div className="card">
            <div className="dash-card-head">
              <Users size={16} />
              <h3>Derniers comptes</h3>
              <Link to="/personnel">Annuaire</Link>
            </div>
            {hr?.recent?.length ? (
              <ul className="dash-list">
                {hr.recent.map((p) => (
                  <li key={p.id}>
                    <Link to={`/personnel/${p.id}`}>
                      {p.firstName} {p.lastName}
                      <small>
                        {roleLabel(p.role)} · {ONBOARD_LABELS[p.onboardStatus] ?? p.onboardStatus}
                      </small>
                    </Link>
                    <span className={`pill${p.isActive ? ' ok' : ' out'}`}>{p.isActive ? 'Actif' : 'Off'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-empty">Pas encore de fiches.</p>
            )}
          </div>
        ) : null}

        {catalog ? (
          <div className="card">
            <div className="dash-card-head">
              <ShoppingBag size={16} />
              <h3>CourseGO</h3>
            </div>
            <p className="dash-empty" style={{ marginBottom: 8 }}>
              Les files vivent dans l’app staff. Ici, l’état du jour.
            </p>
            <ul className="dash-list">
              <li>
                <span>
                  <Truck size={14} /> File ramassage
                </span>
                <strong>{stats?.pickQueue ?? 0}</strong>
              </li>
              <li>
                <span>
                  <Package size={14} /> En ramassage
                </span>
                <strong>{stats?.pickLive ?? 0}</strong>
              </li>
              <li>
                <span>
                  <Truck size={14} /> Livraisons ouvertes
                </span>
                <strong>{stats?.deliverLive ?? 0}</strong>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
