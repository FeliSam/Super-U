import { formatOrderId, useOrders, type Order } from '@/context/OrdersContext';
import { useNotifications } from '@/context/NotificationsContext';
import type { NotificationIcon } from '@/data/notifications';
import { getAuthToken } from '@/lib/api/http';
import { OPS_EVENT_COPY, fulfillmentPhase, type FulfillmentPhase } from '@/lib/orderOps';
import { useEffect, useRef } from 'react';

function phaseCopy(order: Order, phase: FulfillmentPhase): {
  title: string;
  preview: string;
  body: string;
  icon: NotificationIcon;
} {
  const label = formatOrderId(order.id);
  const store = order.storeName || 'Super U';
  const who = order.pickerName || order.courierName;
  const slot = order.slotLabel ? ` Créneau : ${order.dayLabel}, ${order.slotLabel}.` : '';

  switch (phase) {
    case 'wait':
      return {
        title: 'Commande reçue',
        preview: `${label} · en attente de l’app course`,
        body: `Votre commande ${label} est chez ${store}. Elle sera acceptée depuis l’app course, puis rassemblée avant le départ.${slot}`,
        icon: 'check-circle',
      };
    case 'accepted':
      return {
        title: 'Commande acceptée',
        preview: who ? `${label} · ${who} rassemble le panier` : `${label} · prise en charge magasin`,
        body: `${who || 'Le magasin'} a accepté ${label}. Le panier est en cours de rassemblement chez ${store}.`,
        icon: 'package',
      };
    case 'assembled':
      return {
        title: 'Commande rassemblée',
        preview: `${label} · colis prêt, en attente de la course`,
        body: `Le panier ${label} est prêt chez ${store}. La course commencera dès que le coursier partira avec le colis.`,
        icon: 'package',
      };
    case 'course':
      return {
        title: 'Course commencée',
        preview: `${label} · ${order.courierName || 'votre livreur'} est en route`,
        body: `${order.courierName || 'Le coursier'} a commencé la course ${label} vers ${order.addressLabel}. Suivez le trajet en direct.`,
        icon: 'truck',
      };
    case 'arrived':
      return {
        title: 'Livreur arrivé',
        preview: `${label} · à votre adresse`,
        body: `${order.courierName || 'Le coursier'} est arrivé pour ${label} à ${order.addressLabel}.`,
        icon: 'map-pin',
      };
    case 'delivered':
      return {
        title: 'Commande livrée',
        preview: `${label} a été livrée. Merci !`,
        body: `Votre commande ${label} a été livrée à ${order.addressLabel}. Vous pouvez noter les produits et le livreur.`,
        icon: 'smile',
      };
    case 'failed':
      return {
        title: 'Livraison non aboutie',
        preview: `${label} n’a pas pu être remise.`,
        body: `La course ${label} n’a pas pu être terminée. Ouvrez le suivi pour choisir une action (nouvelle tentative, assistance, nouvelle commande).`,
        icon: 'x-circle',
      };
    case 'cancelled':
      return {
        title: 'Commande annulée',
        preview: `${label} a été annulée.`,
        body: `Votre commande ${label} a été annulée.`,
        icon: 'x-circle',
      };
  }
}

function eventCopy(order: Order, eventType: string) {
  const label = formatOrderId(order.id);
  const body = OPS_EVENT_COPY[eventType];
  const titles: Record<string, { title: string; icon: NotificationIcon }> = {
    'pick.claimed': { title: 'Commande acceptée', icon: 'package' },
    'pick.started': { title: 'Rassemblement commencé', icon: 'package' },
    'pick.packed': { title: 'Commande rassemblée', icon: 'package' },
    'delivery.claimed': { title: 'Course prise', icon: 'truck' },
    'delivery.at_store': { title: 'Coursier au magasin', icon: 'map-pin' },
    'delivery.picked_up': { title: 'Course commencée', icon: 'truck' },
    'delivery.en_route': { title: 'Livreur en route', icon: 'truck' },
    'delivery.arrived': { title: 'Livreur arrivé', icon: 'map-pin' },
    'delivery.delivered': { title: 'Commande livrée', icon: 'smile' },
    'delivery.failed': { title: 'Livraison non aboutie', icon: 'x-circle' },
  };
  const meta = titles[eventType];
  if (!meta || !body) return null;
  return {
    title: meta.title,
    preview: `${label} · ${body}`,
    body,
    icon: meta.icon,
  };
}

function eventNotifId(orderId: string, eventId: number) {
  return `order-${orderId}-evt-${eventId}`;
}

function phaseNotifId(orderId: string, phase: FulfillmentPhase) {
  return `order-${orderId}-${phase}`;
}

export function OrderNotificationBridge() {
  const { orders, ready: ordersReady } = useOrders();
  const { ready: notifReady, push, hasId } = useNotifications();
  const seenRef = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!ordersReady || !notifReady) return;
    if (getAuthToken()) return;

    if (!bootstrapped.current) {
      for (const order of orders) {
        seenRef.current.add(phaseNotifId(order.id, fulfillmentPhase(order)));
        for (const event of order.opsEvents ?? []) {
          seenRef.current.add(eventNotifId(order.id, event.id));
        }
      }
      bootstrapped.current = true;
      return;
    }

    for (const order of orders) {
      const events = order.opsEvents ?? [];
      if (events.length) {
        for (const event of events) {
          const id = eventNotifId(order.id, event.id);
          if (seenRef.current.has(id) || hasId(id)) {
            seenRef.current.add(id);
            continue;
          }
          const copy = eventCopy(order, event.eventType);
          if (!copy) {
            seenRef.current.add(id);
            continue;
          }
          seenRef.current.add(id);
          push({
            id,
            ...copy,
            orderId: order.id,
            actionLabel: event.eventType === 'delivery.delivered' ? 'Voir la commande' : 'Suivre la commande',
            actionHref: `/tracking?id=${order.id}`,
            createdAt: Date.now(),
          });
        }
        continue;
      }

      const phase = fulfillmentPhase(order);
      const id = phaseNotifId(order.id, phase);
      if (seenRef.current.has(id) || hasId(id)) {
        seenRef.current.add(id);
        continue;
      }
      seenRef.current.add(id);
      const copy = phaseCopy(order, phase);
      const trackable = phase !== 'cancelled';
      push({
        id,
        ...copy,
        orderId: order.id,
        actionLabel: trackable ? (phase === 'delivered' ? 'Voir la commande' : 'Suivre la commande') : undefined,
        actionHref: trackable ? `/tracking?id=${order.id}` : undefined,
        createdAt: Date.now(),
      });
    }
  }, [orders, ordersReady, notifReady, push, hasId]);

  return null;
}
