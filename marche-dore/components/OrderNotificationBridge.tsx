import { formatOrderId, useOrders, type Order, type OrderStatus } from '@/context/OrdersContext';
import { useNotifications } from '@/context/NotificationsContext';
import type { NotificationIcon } from '@/data/notifications';
import { useEffect, useRef } from 'react';

function statusCopy(order: Order, status: OrderStatus): {
  title: string;
  preview: string;
  body: string;
  icon: NotificationIcon;
} {
  const label = formatOrderId(order.id);
  const store = order.storeName || 'Super U';
  const articles = `${order.itemCount} article${order.itemCount > 1 ? 's' : ''}`;
  const slot = order.slotLabel ? ` Créneau : ${order.dayLabel}, ${order.slotLabel}.` : '';

  switch (status) {
    case 'confirmed':
      return {
        title: 'Commande confirmée',
        preview: `${label} · ${articles} · ${store}`,
        body: `Votre commande ${label} (${articles}) a bien été enregistrée chez ${store}. Nous préparons bientôt votre panier.${slot}`,
        icon: 'check-circle',
      };
    case 'preparing':
      return {
        title: 'Commande en préparation',
        preview: `${label} est en cours de préparation.`,
        body: `Bonne nouvelle ! Votre commande ${label} est en préparation chez ${store}. Livraison prévue à ${order.addressLabel} (${order.addressLine}).${slot}`,
        icon: 'package',
      };
    case 'shipping':
      return {
        title: 'Livreur en route',
        preview: `${label} · ${order.courierName || 'votre livreur'} arrive bientôt.`,
        body: `Votre commande ${label} est en livraison vers ${order.addressLabel}. ${order.courierName || 'Le livreur'} est en route — suivez le trajet en direct.`,
        icon: 'truck',
      };
    case 'delivered':
      return {
        title: 'Commande livrée',
        preview: `${label} a été livrée. Merci !`,
        body: `Votre commande ${label} a été livrée à ${order.addressLabel}. Merci pour votre confiance — vous pouvez noter les produits et le livreur.`,
        icon: 'smile',
      };
    case 'cancelled':
      return {
        title: 'Commande annulée',
        preview: `${label} a été annulée.`,
        body: `Votre commande ${label} a été annulée. Aucun débit n’a été conservé pour cette livraison. Recommandez quand vous voulez.`,
        icon: 'x-circle',
      };
  }
}

function notifId(orderId: string, status: OrderStatus) {
  return `order-${orderId}-${status}`;
}

/**
 * Émet une notification à la création et à chaque changement de statut de commande.
 */
export function OrderNotificationBridge() {
  const { orders, ready: ordersReady } = useOrders();
  const { ready: notifReady, push, hasId } = useNotifications();
  const seenRef = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!ordersReady || !notifReady) return;

    if (!bootstrapped.current) {
      for (const order of orders) {
        seenRef.current.add(notifId(order.id, order.status));
      }
      bootstrapped.current = true;
      return;
    }

    for (const order of orders) {
      const id = notifId(order.id, order.status);
      if (seenRef.current.has(id) || hasId(id)) {
        seenRef.current.add(id);
        continue;
      }
      seenRef.current.add(id);
      const copy = statusCopy(order, order.status);
      const trackable =
        order.status === 'confirmed' ||
        order.status === 'preparing' ||
        order.status === 'shipping' ||
        order.status === 'delivered';
      push({
        id,
        ...copy,
        orderId: order.id,
        actionLabel: trackable
          ? order.status === 'delivered'
            ? 'Voir la commande'
            : 'Suivre la commande'
          : undefined,
        actionHref: trackable ? `/tracking?id=${order.id}` : undefined,
        createdAt: Date.now(),
      });
    }
  }, [orders, ordersReady, notifReady, push, hasId]);

  return null;
}
