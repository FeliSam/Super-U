export const INCIDENT_REASONS = [
  { id: 'client_absent', title: 'Client absent', hint: 'Personne à l’adresse après plusieurs essais.' },
  { id: 'wrong_address', title: 'Adresse incorrecte', hint: 'Le lieu ne correspond pas à l’adresse indiquée.' },
  { id: 'product_issue', title: 'Produit abîmé ou incomplet', hint: 'Le colis n’est plus livrable en l’état.' },
  { id: 'network', title: 'Problème de réseau', hint: 'Impossible de joindre le client ou l’appli.' },
  { id: 'access', title: 'Accès impossible', hint: 'Rue bloquée, résidence fermée, zone inaccessible.' },
  { id: 'vehicle', title: 'Panne ou incident véhicule', hint: 'Moto / véhicule hors service en course.' },
  { id: 'other', title: 'Autre incident', hint: 'Décrivez la situation.' },
] as const;

export type IncidentId = (typeof INCIDENT_REASONS)[number]['id'];
