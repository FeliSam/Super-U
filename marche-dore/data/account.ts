import { appLocation } from '@/constants/location';
import type { LngLat } from '@/constants/map';

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  /** Data URL or file URI for the account photo. Empty = catalog placeholder. */
  photoUri: string;
};

export type DeliveryAddress = {
  id: string;
  label: string;
  line: string;
  city: string;
  phone: string;
  default: boolean;
  /** [lng, lat] — pin MapLibre / simulation livreur */
  coordinate: LngLat;
};

export type PaymentMethod = {
  id: string;
  type: string;
  detail: string;
  icon: 'smartphone' | 'credit-card' | 'dollar-sign';
  default: boolean;
};

export const userProfile: UserProfile = {
  firstName: 'Merveille',
  lastName: 'ADJO',
  email: 'demo@marchedore.bj',
  phone: appLocation.phone,
  birthDate: '12/08/1990',
  photoUri: '',
};

export const deliveryAddresses: DeliveryAddress[] = [
  {
    id: 'home',
    label: 'Domicile',
    line: appLocation.defaultLine,
    city: appLocation.city,
    phone: appLocation.phone,
    default: true,
    coordinate: [appLocation.longitude, appLocation.latitude],
  },
  {
    id: 'work',
    label: 'Bureau',
    line: 'Boulevard de la Marina, Cadjehoun',
    city: appLocation.city,
    phone: appLocation.phone,
    default: false,
    coordinate: [2.3905, 6.3558],
  },
];

export const paymentMethods: PaymentMethod[] = [
  { id: 'om', type: 'Orange Money', detail: '01 *** ** ** 00', icon: 'smartphone', default: true },
  { id: 'wave', type: 'MTN MoMo', detail: '01 *** ** ** 00', icon: 'smartphone', default: false },
  { id: 'card', type: 'Carte bancaire', detail: '**** 4242', icon: 'credit-card', default: false },
  { id: 'cod', type: 'Paiement à la livraison', detail: 'Espèces ou mobile money', icon: 'dollar-sign', default: false },
];

export type LoyaltyTier = {
  id: string;
  name: string;
  minPoints: number;
};

export type LoyaltyReward = {
  id: string;
  title: string;
  subtitle: string;
  cost: number;
  code?: string;
  available: boolean;
};

export const loyaltyTiers: LoyaltyTier[] = [
  { id: 'bronze', name: 'Bronze', minPoints: 0 },
  { id: 'argent', name: 'Argent', minPoints: 200 },
  { id: 'or', name: 'Or', minPoints: 400 },
  { id: 'platine', name: 'Platine', minPoints: 800 },
];

export const loyaltyAccount = {
  clientId: 'MD-8847-2190',
  cardNumber: 'MD · 8847 2190',
  memberName: 'Merveille ADJO',
  points: 450,
  nextRewardAt: 500,
  tierId: 'or',
  memberSince: 'Mars 2024',
  lifetimeSaved: 18500,
};

export const loyaltyRewards: LoyaltyReward[] = [
  {
    id: 'r2',
    title: 'Réduction −2 000 F',
    subtitle: 'Bientôt disponible au panier',
    cost: 400,
    available: false,
  },
  {
    id: 'r3',
    title: '−10% fruits & légumes',
    subtitle: 'Bientôt disponible',
    cost: 300,
    available: false,
  },
];

export const loyaltyEarnRules = [
  { icon: 'shopping-bag' as const, title: '1 pt / 1 000 F', subtitle: 'Sur chaque commande validée' },
  { icon: 'star' as const, title: '+50 pts avis', subtitle: 'Après un avis produit avec photo' },
  { icon: 'user-plus' as const, title: '+100 pts parrainage', subtitle: 'Quand un ami commande' },
];

/** Stable payload encoded into each member's loyalty QR code. */
export function buildLoyaltyQrPayload(account: typeof loyaltyAccount = loyaltyAccount) {
  return JSON.stringify({
    v: 1,
    type: 'marche-dore-loyalty',
    clientId: account.clientId,
    card: account.cardNumber.replace(/\s·\s/g, '-').replace(/\s/g, ''),
    name: account.memberName,
  });
}
