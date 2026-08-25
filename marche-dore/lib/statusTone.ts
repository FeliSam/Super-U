import type { AppColors } from '@/constants/theme';
import type { OrderStatus } from '@/context/OrdersContext';

/** Theme-aware status chip tones for orders / tracking. */
export function statusTone(status: OrderStatus, colors: AppColors) {
  switch (status) {
    case 'confirmed':
      return {
        bg: colors.successSoft,
        text: colors.green,
        dot: colors.green,
        icon: 'check-circle' as const,
      };
    case 'preparing':
      return {
        bg: colors.cream,
        text: colors.gold,
        dot: colors.gold,
        icon: 'package' as const,
      };
    case 'shipping':
      return {
        bg: colors.blush,
        text: colors.terracotta,
        dot: colors.terracotta,
        icon: 'truck' as const,
      };
    case 'delivered':
      return {
        bg: colors.successSoft,
        text: colors.green,
        dot: colors.green,
        icon: 'home' as const,
      };
    case 'cancelled':
      return {
        bg: colors.blush,
        text: colors.muted,
        dot: colors.muted,
        icon: 'x-circle' as const,
      };
    default:
      return {
        bg: colors.cream,
        text: colors.gold,
        dot: colors.gold,
        icon: 'package' as const,
      };
  }
}
