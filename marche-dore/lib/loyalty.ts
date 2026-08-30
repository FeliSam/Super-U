import {
  loyaltyAccount,
  loyaltyTiers,
  type LoyaltyTier,
} from '@/data/account';
import type { Order } from '@/context/OrdersContext';
import { useProfile } from '@/context/ProfileContext';
import { useUiState } from '@/context/UiStateContext';

import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { useMemo } from 'react';

export const LOYALTY_FCFA_PER_POINT = 1000;
export const LOYALTY_RATE_LABEL = '1 pt / 1 000 F';

/** 1 pt / 1 000 F CFA sur commandes non annulées (règle fidélité Marché Doré). */
export function pointsFromOrders(orders: Order[]): number {
  const spent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  return Math.floor(spent / LOYALTY_FCFA_PER_POINT);
}

export function lifetimeSavedEstimate(orders: Order[]): number {
  return orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
}

export function tierForPoints(points: number): LoyaltyTier {
  let current = loyaltyTiers[0];
  for (const tier of loyaltyTiers) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

export function nextRewardAt(points: number): number {
  const thresholds = [200, 300, 400, 500, 800, 1000];
  return thresholds.find((t) => t > points) ?? points + 100;
}

export type LiveLoyalty = {
  points: number;
  tier: LoyaltyTier;
  tierLabel: string;
  nextRewardAt: number;
  pointsLeft: number;
  progress: number;
  lifetimeSaved: number;
  orderCount: number;
  memberName: string;
  clientId: string;
  cardNumber: string;
  memberSince: string;
  profileSubtitle: string;
};

export function useLiveLoyalty(): LiveLoyalty {
  const { orders } = useOrders();
  const { profile } = useProfile();
  const { session } = useAuth();
  const { loyaltyBonusPts } = useUiState();

  return useMemo(() => {
    const points = Math.max(0, pointsFromOrders(orders) + loyaltyBonusPts);
    const tier = tierForPoints(points);
    const next = nextRewardAt(points);
    const pointsLeft = Math.max(0, next - points);
    const memberName = `${profile.firstName} ${profile.lastName}`.trim() || loyaltyAccount.memberName;
    const feminine = /a$/i.test(memberName.split(' ')[0] ?? '') ? 'Cliente' : 'Client';
    const created = session?.createdAt ? new Date(session.createdAt) : null;
    const memberSince = created && !Number.isNaN(created.getTime())
      ? created.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      : loyaltyAccount.memberSince;
    const id = (session?.accountId ?? '0000').replace(/\D/g, '').slice(-4).padStart(4, '0');
    return {
      points,
      tier,
      tierLabel: `${feminine} ${tier.name}`,
      nextRewardAt: next,
      pointsLeft,
      progress: Math.min(1, points / Math.max(1, next)),
      lifetimeSaved: lifetimeSavedEstimate(orders),
      orderCount: orders.filter((o) => o.status !== 'cancelled').length,
      memberName,
      clientId: `MD-${id}`,
      cardNumber: `**** ${id}`,
      memberSince,
      profileSubtitle: `${feminine} ${tier.name} · ${points} pts`,
    };
  }, [orders, loyaltyBonusPts, profile.firstName, profile.lastName, session?.accountId, session?.createdAt]);
}
