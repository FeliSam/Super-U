import {
  loyaltyAccount,
  loyaltyTiers,
  type LoyaltyTier,
} from '@/data/account';
import type { Order } from '@/context/OrdersContext';
import { useOrders } from '@/context/OrdersContext';
import { useMemo } from 'react';

/** 1 pt / 100 F CFA sur commandes non annulées (règle fidélité Marché Doré). */
export function pointsFromOrders(orders: Order[]): number {
  const spent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  return Math.floor(spent / 100);
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

  return useMemo(() => {
    const points = pointsFromOrders(orders);
    const tier = tierForPoints(points);
    const next = nextRewardAt(points);
    const pointsLeft = Math.max(0, next - points);
    const feminine = /a$/i.test(loyaltyAccount.memberName.split(' ')[0] ?? '') ? 'Cliente' : 'Client';
    return {
      points,
      tier,
      tierLabel: `${feminine} ${tier.name}`,
      nextRewardAt: next,
      pointsLeft,
      progress: Math.min(1, points / Math.max(1, next)),
      lifetimeSaved: lifetimeSavedEstimate(orders),
      orderCount: orders.filter((o) => o.status !== 'cancelled').length,
      memberName: loyaltyAccount.memberName,
      clientId: loyaltyAccount.clientId,
      cardNumber: loyaltyAccount.cardNumber,
      memberSince: loyaltyAccount.memberSince,
      profileSubtitle: `${feminine} ${tier.name} · ${points} pts`,
    };
  }, [orders]);
}
