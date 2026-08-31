import { ROLE_HELP, roleLabel } from '@/lib/staffLabels';

const MATRIX: { role: string; course: string; pick: string; deliver: string; catalog: string; rh: string }[] = [
  { role: 'coursier', course: 'oui', pick: 'oui', deliver: 'oui', catalog: 'non', rh: 'non' },
  { role: 'picker', course: 'oui', pick: 'oui', deliver: 'non', catalog: 'non', rh: 'non' },
  { role: 'courier', course: 'oui', pick: 'non', deliver: 'oui', catalog: 'non', rh: 'non' },
  { role: 'dispatcher', course: 'optionnel', pick: 'non', deliver: 'non', catalog: 'non', rh: 'non' },
  { role: 'manager', course: 'non', pick: 'non', deliver: 'non', catalog: 'son magasin', rh: 'son magasin' },
  { role: 'magasinier', course: 'non', pick: 'non', deliver: 'non', catalog: 'stock', rh: 'non' },
  { role: 'admin', course: 'non', pick: 'non', deliver: 'non', catalog: 'tous', rh: 'tous' },
  { role: 'recruteur', course: 'non', pick: 'non', deliver: 'non', catalog: 'non', rh: 'créer / onboarding' },
  { role: 'support', course: 'non', pick: 'non', deliver: 'non', catalog: 'non', rh: 'lecture' },
];

export function RolesHelpPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2>Rôles</h2>
          <p>Un rôle back-office, des flags CourseGO (ramassage / livraison), un magasin.</p>
        </div>
      </div>
      <div className="card" style={{ overflow: 'auto', padding: 0, marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Rôle</th>
              <th>CourseGO</th>
              <th>Ramasse</th>
              <th>Livre</th>
              <th>Catalogue</th>
              <th>RH</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((r) => (
              <tr key={r.role}>
                <td>
                  <strong>{roleLabel(r.role)}</strong>
                </td>
                <td>{r.course}</td>
                <td>{r.pick}</td>
                <td>{r.deliver}</td>
                <td>{r.catalog}</td>
                <td>{r.rh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {Object.entries(ROLE_HELP).map(([k, v]) => (
          <div key={k} className="card">
            <strong>{roleLabel(k)}</strong>
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>{v}</p>
          </div>
        ))}
      </div>
    </>
  );
}
