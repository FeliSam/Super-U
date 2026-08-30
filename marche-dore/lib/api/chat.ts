import {
  conversationThreads,
  conversations as catalogConversations,
  TRIAL_CHAT_ID,
  type ChatMessage,
  type Conversation,
  type ConversationKind,
} from '@/data/messages';
import { avatar } from '@/data/catalog';

type OrderLike = {
  id: string;
  status: string;
  courierName?: string;
  courierPhone?: string;
  pickerName?: string;
  commsThreadId?: string | null;
};

/** Clock label HH:mm for bubbles / inbox. */
export function formatChatClock(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function buildOutboundMessage(text: string): ChatMessage {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: 'me',
    text: text.trim(),
    time: formatChatClock(),
  };
}

const AUTO_REPLIES: Record<ConversationKind, string[]> = {
  support: [
    'Merci pour votre message. Un conseiller vous répond sous peu.',
    'C’est noté. Nous revenons vers vous dans quelques minutes.',
    'Bien reçu. Pouvez-vous préciser le numéro de commande si vous l’avez ?',
  ],
  courier: [
    'Parfait, c’est noté. À tout à l’heure !',
    'Compris, j’adapte mon arrivée.',
    'Merci ! Je vous préviens dès que je suis en bas.',
  ],
  order: [
    'Merci, nous restons disponibles si besoin.',
    'C’est enregistré. Vous pouvez suivre l’état dans Suivi commande.',
  ],
};

export function buildAutoReply(kind: ConversationKind): ChatMessage {
  const pool = AUTO_REPLIES[kind] ?? AUTO_REPLIES.support;
  const text = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: 'them',
    text,
    time: formatChatClock(),
  };
}

export const DEMO_CHAT_IDS = new Set(['courier-bodouin', 'courier-fatou', 'courier-ibrahima']);

export function isActiveCourierOrder(status: string) {
  return status === 'preparing' || status === 'shipping';
}

export function courierThreadId(order: string | { id: string; commsThreadId?: string | null }) {
  if (typeof order === 'string') return `courier-${order.replace(/^#/, '')}`;
  return order.commsThreadId || `courier-${order.id.replace(/^#/, '')}`;
}

export function isDemoChatText(text: string) {
  return /Merveille|#MD-2024-084[257]/i.test(text);
}

export function supportConversation(): Conversation {
  return {
    id: 'support',
    kind: 'support',
    name: 'Assistance Marché Doré',
    subtitle: 'Support client · 7j/7',
    preview: 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?',
    time: 'Maintenant',
    unread: 0,
    online: true,
    icon: 'headphones',
  };
}

export function supportWelcomeThread(firstName: string): ChatMessage[] {
  const name = firstName.trim();
  const greet = name ? `Bonjour ${name}` : 'Bonjour';
  return [
    {
      id: 's-welcome',
      from: 'them',
      text: `${greet}, bienvenue sur l’assistance Marché Doré. Que pouvons-nous faire pour vous ?`,
      time: formatChatClock(),
    },
  ];
}

function orderLabel(orderId: string) {
  return `#${orderId.replace(/^#/, '')}`;
}

export function conversationFromOrder(order: OrderLike): Conversation {
  const label = orderLabel(order.id);
  return {
    id: courierThreadId(order),
    kind: 'courier',
    name: order.courierName?.trim() || order.pickerName?.trim() || 'Course Marché Doré',
    subtitle: `Course · ${label}`,
    preview: 'Votre livreur vous contacte ici.',
    time: 'Maintenant',
    unread: 0,
    online: order.status === 'shipping' || order.status === 'preparing',
    phone: order.courierPhone || undefined,
    orderId: order.id,
    icon: 'truck',
  };
}

export function courierWelcomeThread(order: OrderLike, firstName: string): ChatMessage[] {
  const name = firstName.trim();
  const greet = name ? `Bonjour ${name}` : 'Bonjour';
  const courier = order.courierName?.trim() || order.pickerName?.trim() || 'l’équipe magasin';
  const label = orderLabel(order.id);
  return [
    {
      id: `cw-${order.id}`,
      from: 'them',
      text: `${greet} ! Je suis ${courier}, votre livreur Marché Doré. Votre commande ${label} est en cours.`,
      time: formatChatClock(),
    },
  ];
}

export async function listConversations(): Promise<Conversation[]> {
  await Promise.resolve();
  return [supportConversation()];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await Promise.resolve();
  if (id === 'support') return supportConversation();
  const found = catalogConversations.find((c) => c.id === id);
  return found ? { ...found } : null;
}

export async function getThreadMessages(id: string): Promise<ChatMessage[]> {
  await Promise.resolve();
  if (id === 'support') return [];
  const thread = conversationThreads[id];
  return thread ? thread.map((m) => ({ ...m })) : [];
}

export function trialConversation(): Conversation {
  return {
    id: TRIAL_CHAT_ID,
    kind: 'courier',
    name: 'Koffi Adjovi',
    subtitle: 'Coursier · conversation d’essai',
    preview: 'Appuyez sur le téléphone pour un appel dans l’appli.',
    time: 'Maintenant',
    unread: 1,
    online: true,
    avatar,
    phone: '+229 01 40 00 00 01',
  };
}

export function trialThread(firstName: string): ChatMessage[] {
  const name = firstName.trim();
  const greet = name ? `Bonjour ${name}` : 'Bonjour';
  return [
    {
      id: 'e1',
      from: 'them',
      text: `${greet} ! Je suis Koffi, coursier Marché Doré. Ceci est une conversation d’essai pour le chat et l’appel dans l’appli.`,
      time: formatChatClock(),
    },
    {
      id: 'e2',
      from: 'them',
      text: 'Appuyez sur le téléphone en haut à droite pour m’appeler. Je peux aussi vous appeler automatiquement à l’ouverture.',
      time: formatChatClock(),
    },
  ];
}

export function formatCallMessage(call: NonNullable<ChatMessage['call']>): string {
  const dur =
    typeof call.durationSec === 'number' && call.durationSec > 0
      ? ` · ${Math.floor(call.durationSec / 60)}:${String(call.durationSec % 60).padStart(2, '0')}`
      : '';
  if (call.status === 'missed') return call.direction === 'in' ? 'Appel manqué' : 'Appel non abouti';
  if (call.status === 'rejected') return 'Appel refusé';
  if (call.status === 'canceled') return 'Appel annulé';
  return `Appel${dur}`;
}

export async function seedChatBundle(firstName = ''): Promise<{
  conversations: Conversation[];
  threads: Record<string, ChatMessage[]>;
}> {
  const trial = trialConversation();
  const conversations = [supportConversation(), trial];
  return {
    conversations,
    threads: {
      support: supportWelcomeThread(firstName),
      [TRIAL_CHAT_ID]: trialThread(firstName),
    },
  };
}
