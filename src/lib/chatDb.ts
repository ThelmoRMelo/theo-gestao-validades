/**
 * ═══════════════════════════════════════════════════════
 * GESTÃO DE VALIDADES - BANCO DE DADOS DE CHAT (IndexedDB)
 * Sistema Offline-First para Chat
 * ═══════════════════════════════════════════════════════
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ═══ CONSTANTES ═══
export const GLOBAL_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';

// ═══ TIPOS ═══
export interface ChatConversation {
  id: string;
  type: 'global' | 'private';
  created_at: string;
  pending_sync?: boolean;
}

export interface ChatParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name?: string;
  created_at: string;
  pending_sync?: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name: string;
  message: string;
  reactions: Record<string, number>;
  deleted: boolean;
  created_at: string;
  pending_sync: boolean;
}

// ═══ SCHEMA DO BANCO DE CHAT ═══
interface ChatDBSchema extends DBSchema {
  chat_conversations: {
    key: string;
    value: ChatConversation;
    indexes: { 'by-type': string };
  };
  chat_participants: {
    key: string;
    value: ChatParticipant;
    indexes: { 
      'by-conversation': string;
      'by-user': string;
    };
  };
  chat_messages: {
    key: string;
    value: ChatMessage;
    indexes: { 
      'by-conversation': string;
      'by-created': string;
      'by-pending': number;
    };
  };
}

const CHAT_DB_NAME = 'gestao-validades-chat-db';
const CHAT_DB_VERSION = 1;

let chatDbInstance: IDBPDatabase<ChatDBSchema> | null = null;

// ═══ INICIALIZAÇÃO DO BANCO ═══
export async function initChatDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (chatDbInstance) return chatDbInstance;

  chatDbInstance = await openDB<ChatDBSchema>(CHAT_DB_NAME, CHAT_DB_VERSION, {
    upgrade(db) {
      // Conversations
      if (!db.objectStoreNames.contains('chat_conversations')) {
        const convStore = db.createObjectStore('chat_conversations', { keyPath: 'id' });
        convStore.createIndex('by-type', 'type');
      }

      // Participants
      if (!db.objectStoreNames.contains('chat_participants')) {
        const partStore = db.createObjectStore('chat_participants', { keyPath: 'id' });
        partStore.createIndex('by-conversation', 'conversation_id');
        partStore.createIndex('by-user', 'user_id');
      }

      // Messages
      if (!db.objectStoreNames.contains('chat_messages')) {
        const msgStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
        msgStore.createIndex('by-conversation', 'conversation_id');
        msgStore.createIndex('by-created', 'created_at');
        msgStore.createIndex('by-pending', 'pending_sync');
      }
    },
  });

  // Garantir que a conversa global exista
  await ensureGlobalConversation();

  return chatDbInstance;
}

// ═══ GARANTIR CONVERSA GLOBAL ═══
async function ensureGlobalConversation(): Promise<void> {
  const db = await initChatDB();
  const existing = await db.get('chat_conversations', GLOBAL_CONVERSATION_ID);
  
  if (!existing) {
    await db.put('chat_conversations', {
      id: GLOBAL_CONVERSATION_ID,
      type: 'global',
      created_at: new Date().toISOString(),
    });
  }
}

// ═══ FUNÇÕES PARA CONVERSAS ═══
export async function getConversation(id: string): Promise<ChatConversation | undefined> {
  const db = await initChatDB();
  return db.get('chat_conversations', id);
}

export async function getAllConversations(): Promise<ChatConversation[]> {
  const db = await initChatDB();
  return db.getAll('chat_conversations');
}

export async function getPrivateConversations(): Promise<ChatConversation[]> {
  const db = await initChatDB();
  return db.getAllFromIndex('chat_conversations', 'by-type', 'private');
}

export async function saveConversation(conversation: ChatConversation): Promise<void> {
  const db = await initChatDB();
  await db.put('chat_conversations', conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await initChatDB();
  
  // Deletar todas as mensagens da conversa
  const messages = await db.getAllFromIndex('chat_messages', 'by-conversation', id);
  const tx = db.transaction(['chat_messages', 'chat_participants', 'chat_conversations'], 'readwrite');
  
  for (const msg of messages) {
    await tx.objectStore('chat_messages').delete(msg.id);
  }
  
  // Deletar participantes
  const participants = await db.getAllFromIndex('chat_participants', 'by-conversation', id);
  for (const part of participants) {
    await tx.objectStore('chat_participants').delete(part.id);
  }
  
  // Deletar conversa
  await tx.objectStore('chat_conversations').delete(id);
  await tx.done;
}

// ═══ FUNÇÕES PARA PARTICIPANTES ═══
export async function getParticipants(conversationId: string): Promise<ChatParticipant[]> {
  const db = await initChatDB();
  return db.getAllFromIndex('chat_participants', 'by-conversation', conversationId);
}

export async function getConversationsByUser(userId: string): Promise<ChatConversation[]> {
  const db = await initChatDB();
  const participants = await db.getAllFromIndex('chat_participants', 'by-user', userId);
  const conversations: ChatConversation[] = [];
  
  for (const part of participants) {
    const conv = await db.get('chat_conversations', part.conversation_id);
    if (conv) conversations.push(conv);
  }
  
  return conversations;
}

export async function saveParticipant(participant: ChatParticipant): Promise<void> {
  const db = await initChatDB();
  await db.put('chat_participants', participant);
}

export async function findPrivateConversation(userId1: string, userId2: string): Promise<ChatConversation | undefined> {
  const db = await initChatDB();
  const privateConvs = await getPrivateConversations();
  
  for (const conv of privateConvs) {
    const participants = await db.getAllFromIndex('chat_participants', 'by-conversation', conv.id);
    const participantIds = participants.map(p => p.user_id);
    
    if (participantIds.includes(userId1) && participantIds.includes(userId2) && participantIds.length === 2) {
      return conv;
    }
  }
  
  return undefined;
}

// ═══ FUNÇÕES PARA MENSAGENS ═══
export async function getMessages(conversationId: string, limit: number = 100): Promise<ChatMessage[]> {
  const db = await initChatDB();
  const messages = await db.getAllFromIndex('chat_messages', 'by-conversation', conversationId);
  
  return messages
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-limit);
}

export async function getMessage(id: string): Promise<ChatMessage | undefined> {
  const db = await initChatDB();
  return db.get('chat_messages', id);
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  const db = await initChatDB();
  await db.put('chat_messages', message);
}

export async function getPendingMessages(): Promise<ChatMessage[]> {
  const db = await initChatDB();
  const all = await db.getAll('chat_messages');
  return all.filter(m => m.pending_sync);
}

export async function bulkSaveMessages(messages: ChatMessage[]): Promise<void> {
  const db = await initChatDB();
  const tx = db.transaction('chat_messages', 'readwrite');
  await Promise.all(messages.map(m => tx.store.put(m)));
  await tx.done;
}

export async function updateMessageReactions(id: string, reactions: Record<string, number>): Promise<void> {
  const db = await initChatDB();
  const message = await db.get('chat_messages', id);
  
  if (message) {
    message.reactions = reactions;
    message.pending_sync = true;
    await db.put('chat_messages', message);
  }
}

export async function markMessageDeleted(id: string): Promise<void> {
  const db = await initChatDB();
  const message = await db.get('chat_messages', id);
  
  if (message) {
    message.deleted = true;
    message.pending_sync = true;
    await db.put('chat_messages', message);
  }
}

export async function clearConversationHistory(conversationId: string): Promise<void> {
  const db = await initChatDB();
  const messages = await db.getAllFromIndex('chat_messages', 'by-conversation', conversationId);
  
  const tx = db.transaction('chat_messages', 'readwrite');
  for (const msg of messages) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
}

// ═══ UTILITÁRIOS ═══
export function generateUUID(): string {
  return crypto.randomUUID();
}

export async function getUnreadCount(conversationId: string, lastReadAt?: string): Promise<number> {
  if (!lastReadAt) return 0;
  
  const db = await initChatDB();
  const messages = await db.getAllFromIndex('chat_messages', 'by-conversation', conversationId);
  
  return messages.filter(m => 
    !m.deleted && 
    new Date(m.created_at) > new Date(lastReadAt)
  ).length;
}
