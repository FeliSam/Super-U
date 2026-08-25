import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { avatar } from '@/data/catalog';
import type { ImageSourcePropType } from 'react-native';

export type ConversationKind = 'support' | 'courier' | 'order';

export type Conversation = {
  id: string;
  kind: ConversationKind;
  name: string;
  subtitle: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  avatar?: ImageSourcePropType;
  icon?: ComponentProps<typeof Feather>['name'];
  phone?: string;
  orderId?: string;
};

export type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
};

export const conversations: Conversation[] = [
  {
    id: 'support',
    kind: 'support',
    name: 'Assistance Marché Doré',
    subtitle: 'Support client · 7j/7',
    preview: 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?',
    time: 'Maintenant',
    unread: 1,
    online: true,
    icon: 'headphones',
  },
  {
    id: 'courier-moussa',
    kind: 'courier',
    name: 'Moussa Ndiaye',
    subtitle: 'Livreur · #MD-2024-0847',
    preview: 'Préférez-vous que je sonne à l’interphone ?',
    time: '11:52',
    unread: 2,
    online: true,
    avatar,
    phone: '+221771234567',
    orderId: 'MD-2024-0847',
  },
  {
    id: 'order-0846',
    kind: 'order',
    name: 'Suivi commande #MD-2024-0846',
    subtitle: 'Livrée · hier',
    preview: 'Votre commande a bien été livrée. Merci et à bientôt !',
    time: 'Hier',
    unread: 0,
    icon: 'package',
    orderId: 'MD-2024-0846',
  },
];

export const conversationThreads: Record<string, ChatMessage[]> = {
  support: [
    {
      id: 's1',
      from: 'them',
      text: 'Bonjour Amina, bienvenue sur l’assistance Marché Doré. Que pouvons-nous faire pour vous ?',
      time: '09:10',
    },
    {
      id: 's2',
      from: 'me',
      text: 'Bonjour, j’aimerais modifier mon créneau de livraison.',
      time: '09:12',
    },
    {
      id: 's3',
      from: 'them',
      text: 'Bien sûr. Pour la commande #MD-2024-0847, le créneau actuel est 14h–16h. Souhaitez-vous 16h–18h à la place ?',
      time: '09:13',
    },
  ],
  'courier-moussa': [
    {
      id: '1',
      from: 'them',
      text: 'Bonjour Amina ! Je suis Moussa, votre livreur Marché Doré. Votre commande #MD-2024-0847 est en préparation.',
      time: '11:48',
    },
    {
      id: '2',
      from: 'me',
      text: 'Bonjour Moussa, merci. Vous serez bien entre 14h et 16h ?',
      time: '11:50',
    },
    {
      id: '3',
      from: 'them',
      text: 'Oui, je pars dès que le panier est prêt. Je vous envoie un message quand je serai en route.',
      time: '11:51',
    },
    {
      id: '4',
      from: 'them',
      text: 'Petite question : préférez-vous que je sonne à l’interphone ou que je vous appelle ?',
      time: '11:52',
    },
  ],
  'order-0846': [
    {
      id: 'o1',
      from: 'them',
      text: 'Votre commande #MD-2024-0846 a été livrée hier à 15:42. Merci pour votre confiance !',
      time: 'Hier',
    },
    {
      id: 'o2',
      from: 'me',
      text: 'Parfait, tout est reçu. Merci !',
      time: 'Hier',
    },
  ],
};

export const quickRepliesByKind: Record<ConversationKind, string[]> = {
  support: ['Modifier le créneau', 'Problème de paiement', 'Suivre ma commande', 'Parler à un agent'],
  courier: ['Sonnez à l’interphone', 'Appelez-moi', 'Merci !', 'Je serai là'],
  order: ['Noter la livraison', 'Commander à nouveau', 'Merci'],
};

export function getConversation(id: string) {
  return conversations.find((c) => c.id === id);
}

export function getThread(id: string) {
  return conversationThreads[id] ?? [];
}

export function unreadMessagesCount() {
  return conversations.reduce((sum, c) => sum + c.unread, 0);
}
