import {
  conversationThreads,
  conversations as seedConversations,
  type ChatMessage,
  type Conversation,
  type ConversationKind,
} from '@/data/messages';

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

/**
 * Client API — messagerie Marché Doré.
 * Remplaçable plus tard par `fetch('/api/chat/...')` si backend branché.
 */
export async function listConversations(): Promise<Conversation[]> {
  await Promise.resolve();
  return seedConversations.map((c) => ({ ...c }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await Promise.resolve();
  const found = seedConversations.find((c) => c.id === id);
  return found ? { ...found } : null;
}

export async function getThreadMessages(id: string): Promise<ChatMessage[]> {
  await Promise.resolve();
  const thread = conversationThreads[id];
  return thread ? thread.map((m) => ({ ...m })) : [];
}

export async function seedChatBundle(): Promise<{
  conversations: Conversation[];
  threads: Record<string, ChatMessage[]>;
}> {
  const conversations = await listConversations();
  const threads: Record<string, ChatMessage[]> = {};
  for (const c of conversations) {
    threads[c.id] = await getThreadMessages(c.id);
  }
  return { conversations, threads };
}
