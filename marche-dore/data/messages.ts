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
  disabled?: boolean;
  archived?: boolean;
};

export type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  kind?: 'text' | 'call';
  call?: {
    direction: 'in' | 'out';
    status: 'missed' | 'ended' | 'rejected' | 'canceled';
    durationSec?: number;
  };
};

export const TRIAL_CHAT_ID = 'courier-essai';

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
    id: 'courier-bodouin',
    kind: 'courier',
    name: 'Bodouin Dognon',
    subtitle: 'Livreur · #MD-2024-0847',
    preview: 'Préférez-vous que je sonne à l’interphone ?',
    time: '11:52',
    unread: 2,
    online: true,
    avatar,
    phone: '+229 01 97 12 34 56',
    orderId: 'MD-2024-0847',
  },
  {
    id: 'courier-fatou',
    kind: 'courier',
    name: 'Fatou Diop',
    subtitle: 'Livreuse · #MD-2024-0845',
    preview: 'Je suis devant le portail, vous descendez ?',
    time: '09:18',
    unread: 1,
    online: true,
    avatar,
    phone: '+229 01 97 55 51 12',
    orderId: 'MD-2024-0845',
  },
  {
    id: 'courier-ibrahima',
    kind: 'courier',
    name: 'Ibrahima Sarr',
    subtitle: 'Livreur · #MD-2024-0842',
    preview: 'Livraison terminée. Bonne dégustation !',
    time: '2 j',
    unread: 0,
    online: false,
    avatar,
    phone: '+229 01 97 66 67 78',
    orderId: 'MD-2024-0842',
  },
  {
    id: 'courier-essai',
    kind: 'courier',
    name: 'Koffi Adjovi',
    subtitle: 'Coursier · conversation d’essai',
    preview: 'Appuyez sur le téléphone pour un appel dans l’appli.',
    time: 'Maintenant',
    unread: 1,
    online: true,
    avatar,
    phone: '+229 01 40 00 00 01',
  },
];

export const conversationThreads: Record<string, ChatMessage[]> = {
  support: [
    {
      id: 's1',
      from: 'them',
      text: 'Bonjour Merveille, bienvenue sur l’assistance Marché Doré. Que pouvons-nous faire pour vous ?',
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
  'courier-bodouin': [
    {
      id: '1',
      from: 'them',
      text: 'Bonjour Merveille ! Je suis Bodouin, votre livreur Marché Doré. Votre commande #MD-2024-0847 est en préparation.',
      time: '11:48',
    },
    {
      id: '2',
      from: 'me',
      text: 'Bonjour Bodouin, merci. Vous serez bien entre 14h et 16h ?',
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
  'courier-fatou': [
    {
      id: 'f1',
      from: 'them',
      text: 'Bonjour ! Fatou pour la commande #MD-2024-0845. J’arrive dans 5 minutes.',
      time: '09:14',
    },
    {
      id: 'f2',
      from: 'me',
      text: 'Parfait, je reste à proximité.',
      time: '09:15',
    },
    {
      id: 'f3',
      from: 'them',
      text: 'Je suis devant le portail, vous descendez ?',
      time: '09:18',
    },
  ],
  'courier-ibrahima': [
    {
      id: 'i1',
      from: 'them',
      text: 'Bonjour, Ibrahima pour #MD-2024-0842. Livraison terminée. Bonne dégustation !',
      time: '2 j',
    },
    {
      id: 'i2',
      from: 'me',
      text: 'Merci beaucoup !',
      time: '2 j',
    },
  ],
  'courier-essai': [
    {
      id: 'e1',
      from: 'them',
      text: 'Bonjour ! Koffi, coursier Marché Doré. Ceci est une conversation d’essai pour tester le chat et l’appel dans l’appli.',
      time: '19:20',
    },
    {
      id: 'e2',
      from: 'me',
      text: 'Parfait, je vois vos messages.',
      time: '19:21',
    },
    {
      id: 'e3',
      from: 'them',
      text: 'Appuyez sur le téléphone en haut pour m’appeler. Je peux aussi vous appeler dans quelques secondes.',
      time: '19:21',
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

/** Static seed total — prefer `useChat().unreadTotal` for live badges. */
export function unreadMessagesCount() {
  return conversations.reduce((sum, c) => sum + c.unread, 0);
}
