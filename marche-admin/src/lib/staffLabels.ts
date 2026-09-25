export const ROLE_LABELS: Record<string, string> = {
  coursier: 'Coursier (ramasse + livre)',
  picker: 'Préparateur magasin',
  courier: 'Livreur',
  dispatcher: 'Régulateur',
  manager: 'Chef de magasin',
  magasinier: 'Magasinier (stocks)',
  admin: 'Administrateur siège',
  recruteur: 'Recruteur',
  support: 'Support interne',
  both: 'Coursier',
};

export const ROLE_HELP: Record<string, string> = {
  coursier: 'Terrain : rassemble les courses et les livre. Connexion CourseGO.',
  picker: 'Magasin : scan et ramassage uniquement. Pas de tournée moto.',
  courier: 'Livraison uniquement, sans passage en ramassage.',
  dispatcher: 'Suit le terrain (page Terrain) : présence, ramassages et livraisons live.',
  manager: 'Chef de magasin : catalogue et RH de son Super U.',
  magasinier: 'Stocks et rayons de son magasin. Pas de RH.',
  admin: 'Siège : tous magasins, catalogue, RH, prix.',
  recruteur: 'Crée les fiches terrain. Ni prix, ni catalogue.',
  support: 'Lecture RH interne. Pas d’ops live.',
};

export const ONBOARD_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  invited: 'Invité',
  active: 'Actif',
  suspended: 'Suspendu',
};

/** Compte en attente d'activation (auto-inscription CourseGO ou fiche brouillon / invitée). */
export function isPendingStaff(s: { isActive: boolean; onboardStatus: string }) {
  return !s.isActive && (s.onboardStatus === 'draft' || s.onboardStatus === 'invited');
}

export function staffStatusLabel(s: { isActive: boolean; onboardStatus: string }) {
  if (isPendingStaff(s)) return 'En attente de validation';
  if (!s.isActive) return 'Suspendu';
  return ONBOARD_LABELS[s.onboardStatus] || s.onboardStatus;
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role] || role;
}
