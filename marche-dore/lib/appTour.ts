import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type AppTourStep = {
  id: string;
  href: Href;
  eyebrow: string;
  title: string;
  body: string;
  icon: FeatherName;
};

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: 'home',
    href: '/',
    eyebrow: 'Accueil',
    title: 'Votre marché, ici',
    body: 'Promos, rayons et suggestions. Touchez un produit pour l’ouvrir, le + pour le panier.',
    icon: 'home',
  },
  {
    id: 'home-search',
    href: '/',
    eyebrow: 'Accueil',
    title: 'Cherchez en un geste',
    body: 'La barre du haut lance la recherche. Les puces (Fruits, Cuisine…) filtrent votre fil.',
    icon: 'search',
  },
  {
    id: 'explore',
    href: '/explore',
    eyebrow: 'Explorer',
    title: 'Tous les rayons',
    body: 'Catégories, sélections et grilles — idéal pour flâner sans chercher un nom précis.',
    icon: 'grid',
  },
  {
    id: 'cart',
    href: '/cart',
    eyebrow: 'Panier',
    title: 'Validez vos courses',
    body: 'Quantités, total et passage en caisse. Glissez un article vers la gauche pour le retirer.',
    icon: 'shopping-bag',
  },
  {
    id: 'chat',
    href: '/chat',
    eyebrow: 'Messages',
    title: 'Parlez au terrain',
    body: 'Suivi de commande et échange avec le livreur ou le magasin, au même endroit.',
    icon: 'message-circle',
  },
  {
    id: 'profile',
    href: '/profile',
    eyebrow: 'Profil',
    title: 'Compte & fidélité',
    body: 'Adresses, magasin Super U, commandes et points — tout votre espace personnel.',
    icon: 'user',
  },
];
