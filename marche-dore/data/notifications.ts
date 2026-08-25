import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type NotificationIcon = ComponentProps<typeof Feather>['name'];

export type AppNotification = {
  id: string;
  title: string;
  preview: string;
  body: string;
  time: string;
  read: boolean;
  icon: NotificationIcon;
  actionLabel?: string;
  actionHref?: '/tracking' | '/category/boissons' | '/category/fruits-legumes?filter=Fruits' | '/(tabs)/cart';
};

export const notifications: AppNotification[] = [
  {
    id: 'promo-fruits',
    title: 'Offre flash — Fruits frais',
    preview: '-30% sur les mangues et bananes jusqu’à ce soir.',
    body: 'Profitez de -30% sur une sélection de fruits frais : mangues Kent, bananes douces et ananas. L’offre est valable jusqu’à 23h59 sur les produits éligibles, dans la limite des stocks disponibles.',
    time: 'Il y a 12 min',
    read: false,
    icon: 'tag',
    actionLabel: 'Voir les fruits',
    actionHref: '/category/fruits-legumes?filter=Fruits',
  },
  {
    id: 'order-prep',
    title: 'Commande en préparation',
    preview: 'Votre panier de 4 articles est en cours de préparation.',
    body: 'Bonne nouvelle ! Votre commande #MD-2024-0847 est en préparation au Marché Doré Ganhi. Livraison estimée aujourd’hui entre 14h et 16h à Cotonou, Ganhi.',
    time: 'Il y a 1 h',
    read: false,
    icon: 'package',
    actionLabel: 'Suivre la commande',
    actionHref: '/tracking',
  },
  {
    id: 'boissons-promo',
    title: 'Nouveautés boissons',
    preview: '-15% sur les jus locaux et bissap maison.',
    body: 'Découvrez nos boissons fraîches : bissap gingembre, jus de mangue et bouye. Remise de 15% automatique sur votre prochaine commande de boissons.',
    time: 'Hier',
    read: true,
    icon: 'coffee',
    actionLabel: 'Explorer les boissons',
    actionHref: '/category/boissons',
  },
  {
    id: 'cart-reminder',
    title: 'Articles toujours dans votre panier',
    preview: '7 articles vous attendent — finalisez votre commande.',
    body: 'Vous avez laissé des produits dans votre panier : mangues, lait, plantains et plus encore. Passez commande maintenant pour conserver vos articles et vos promotions.',
    time: 'Hier',
    read: true,
    icon: 'shopping-bag',
    actionLabel: 'Voir mon panier',
    actionHref: '/(tabs)/cart',
  },
  {
    id: 'rentree',
    title: 'La rentrée approche',
    preview: 'Goûters, fournitures et essentiels pour la famille.',
    body: 'Préparez la rentrée sereinement avec notre sélection : goûters, produits laitiers et articles pour bébé & enfant. Livraison rapide sur Cotonou.',
    time: 'Lundi',
    read: true,
    icon: 'gift',
  },
];

export function getNotification(id: string) {
  return notifications.find((n) => n.id === id);
}
