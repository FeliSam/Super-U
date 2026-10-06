import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '@/lib/api';
import { useAppSelector } from '@/app/hooks';
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  Truck,
  ShoppingBag,
  Shield,
  Info,
  LogIn,
} from 'lucide-react';

interface AppCardData {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  apkDownloadUrl: string;
  easBuildUrl: string;
  icon: typeof ShoppingBag;
  color: string;
  creds: { label: string; email: string; pass: string; note: string }[];
}

const APPS: AppCardData[] = [
  {
    id: 'marchedore',
    name: 'Marché Doré',
    category: 'Application Client & E-Commerce',
    badge: 'v1.0.0 (Android APK)',
    description:
      'Application mobile officielle pour les clients : navigation catalogue, panier, commande, géolocalisation de livraison et suivi en temps réel.',
    apkDownloadUrl: '/downloads/marchedore.apk',
    easBuildUrl: 'https://expo.dev/accounts/feliciano6/projects/marche-dore/builds/6d6148a6-e846-4afe-a0c6-a93d3cc64106',
    icon: ShoppingBag,
    color: '#e5a93b',
    creds: [
      {
        label: 'Client démo',
        email: 'demo@marchedore.bj',
        pass: 'marche2024',
        note: 'Merveille ADJO (compte client standard)',
      },
    ],
  },
  {
    id: 'coursego',
    name: 'CourseGO',
    category: 'Application Staff Terrain',
    badge: 'v1.0.0 (Android APK)',
    description:
      'Application réservée aux coursiers (livraison moto, navigation GPS, remise client) et aux ramasseurs en magasin (picking code-barres et préparation).',
    apkDownloadUrl: '/downloads/coursego.apk',
    easBuildUrl: 'https://expo.dev/accounts/feliciano6/projects/coursego/builds/5b6d62d8-2f63-4209-bf2f-0562030cb7a8',
    icon: Truck,
    color: '#3b82f6',
    creds: [
      {
        label: 'Coursier terrain',
        email: 'courier@marchedore.bj',
        pass: 'marche2024',
        note: 'Bodouin Dognon (moto, affilié su-aeroport)',
      },
      {
        label: 'Ramasseur magasin',
        email: 'picker@marchedore.bj',
        pass: 'marche2024',
        note: 'Aicha Kouassi (picking produits)',
      },
    ],
  },
];

export function DownloadsPage() {
  const staff = useAppSelector((s) => s.auth.staff);
  const isAuthenticated = Boolean(staff || getToken());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: isAuthenticated ? '0 0 40px' : '32px 20px 60px',
      }}
    >
      {!isAuthenticated ? (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 24,
            marginBottom: 24,
            borderBottom: '1px solid var(--line)',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #e5a93b, #c4871e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: 22,
                boxShadow: '0 4px 12px rgba(229,169,59,0.3)',
              }}
            >
              U
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>SuperU · Marché Doré</h1>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Portail de téléchargement des applications mobiles</span>
            </div>
          </div>
          <Link
            to="/login"
            className="btn ghost sm"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <LogIn size={16} />
            Connexion Administration
          </Link>
        </header>
      ) : null}

      <div className="topbar">
        <div>
          <h2>Applications Mobiles (Builds APK Android)</h2>
          <p>
            Téléchargez directement les fichiers APK Android prêts à installer sur smartphone pour tester
            l'application client <strong>Marché Doré</strong> et l'application terrain <strong>CourseGO</strong>.
          </p>
        </div>
      </div>

      {/* Grid des deux applications */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginTop: 16 }}>
        {APPS.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 24,
                borderRadius: 16,
                border: '1px solid var(--line)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: app.color,
                }}
              />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: `${app.color}20`,
                        color: app.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={26} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{app.name}</h3>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{app.category}</span>
                    </div>
                  </div>
                  <span className="pill ok" style={{ fontSize: 12 }}>
                    {app.badge}
                  </span>
                </div>

                <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 20 }}>
                  {app.description}
                </p>

                {/* Boutons d'action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  <a
                    href={app.apkDownloadUrl}
                    download
                    className="btn gold"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontWeight: 600,
                      padding: '12px 16px',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={18} />
                    Télécharger l’APK ({app.name})
                  </a>

                  <a
                    href={app.easBuildUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn ghost sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={14} />
                    Historique & builds Expo EAS Cloud
                  </a>
                </div>

                {/* Comptes de test */}
                <div
                  style={{
                    background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
                    Comptes de test recommandés :
                  </div>
                  {app.creds.map((cred, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: idx < app.creds.length - 1 ? '1px dashed var(--line)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{cred.label}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>
                          {cred.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                        onClick={() => copyText(`${app.id}-${idx}`, `${cred.email} / ${cred.pass}`)}
                      >
                        {copiedKey === `${app.id}-${idx}` ? (
                          <>
                            <Check size={12} color="var(--ok)" /> Copié
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copier
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                    Mot de passe commun : <strong>marche2024</strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Identifiants Administrateurs Back-Office */}
      <div
        className="card"
        style={{
          marginTop: 28,
          padding: 24,
          borderRadius: 16,
          border: '1px solid var(--line)',
          background: 'linear-gradient(135deg, rgba(229,169,59,0.06), rgba(0,0,0,0))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Shield size={24} color="#e5a93b" />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            Identifiants Administrateurs Actuels (Dashboard & RH)
          </h3>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
          Ces identifiants sont réservés à l’accès au tableau de bord web d’administration (ce panel) et ne doivent pas
          être saisis dans l'application mobile client ni dans CourseGO.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="pill ok" style={{ fontSize: 11 }}>
                Rôle : Administrateur Général
              </span>
              <button
                type="button"
                className="btn ghost sm"
                style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                onClick={() => copyText('admin', 'admin@marchedore.bj / marche2024')}
              >
                {copiedKey === 'admin' ? <Check size={12} color="var(--ok)" /> : <Copy size={12} />}
              </button>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Amina KPODEKON</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              E-mail : <code style={{ fontWeight: 600 }}>admin@marchedore.bj</code>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
              Mot de passe : <code style={{ fontWeight: 600 }}>marche2024</code>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="pill warn" style={{ fontSize: 11 }}>
                Rôle : Responsable RH & Recrutement
              </span>
              <button
                type="button"
                className="btn ghost sm"
                style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                onClick={() => copyText('rh', 'rh@marchedore.bj / marche2024')}
              >
                {copiedKey === 'rh' ? <Check size={12} color="var(--ok)" /> : <Copy size={12} />}
              </button>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Léa HOUNSOU</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              E-mail : <code style={{ fontWeight: 600 }}>rh@marchedore.bj</code>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
              Mot de passe : <code style={{ fontWeight: 600 }}>marche2024</code>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions d'installation */}
      <div
        className="card"
        style={{
          marginTop: 24,
          padding: 24,
          borderRadius: 16,
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Info size={20} color="var(--muted)" />
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Comment installer un fichier APK sur smartphone Android ?
          </h4>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: 'var(--ink)' }}>
          <li>
            Cliquez sur le bouton <strong>Télécharger l’APK</strong> ci-dessus directement depuis le navigateur de votre
            smartphone ou transférez le fichier téléchargé sur votre appareil.
          </li>
          <li>
            Ouvrez le fichier <code>.apk</code> téléchargé depuis la barre de notification ou l'application « Fichiers ».
          </li>
          <li>
            Si Android affiche un avertissement de sécurité, choisissez <strong>Paramètres</strong> puis activez{' '}
            <em>« Autoriser l’installation d’applications inconnues »</em> pour votre navigateur ou gestionnaire de fichiers.
          </li>
          <li>
            Appuyez sur <strong>Installer</strong>, puis ouvrez l'application et connectez-vous avec l'un des comptes
            de test ci-dessus.
          </li>
        </ol>
      </div>
    </div>
  );
}
