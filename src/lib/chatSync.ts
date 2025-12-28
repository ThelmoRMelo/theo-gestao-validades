/**
 * ═══════════════════════════════════════════════════════
 * GESTÃO DE VALIDADES - SINCRONIZAÇÃO DE CHAT
 * Sync entre IndexedDB e Lovable Cloud
 * ═══════════════════════════════════════════════════════
 */

import { supabase } from '@/integrations/supabase/client';
import * as chatDb from './chatDb';
import type { ChatConversation, ChatMessage, ChatParticipant } from './chatDb';

// ═══ ESTADO ═══
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function getChatIsOnline(): boolean {
  return isOnline;
}

// Atualizar estado de conexão
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    syncPendingChatData();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

// ═══ SYNC MENSAGENS PENDENTES ═══
export async function syncPendingChatData(): Promise<void> {
  if (!isOnline) return;

  console.log('🔄 Sincronizando chat pendente...');

  try {
    const pendingMessages = await chatDb.getPendingMessages();
    
    for (const msg of pendingMessages) {
      try {
        const { error } = await supabase
          .from('chat_messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversation_id,
            user_id: msg.user_id,
            user_name: msg.user_name,
            message: msg.message,
            reactions: msg.reactions,
            deleted: msg.deleted,
          }, { onConflict: 'id' });

        if (!error) {
          await chatDb.saveMessage({ ...msg, pending_sync: false });
        }
      } catch (error) {
        console.error('Erro ao sincronizar mensagem:', error);
      }
    }

    console.log('✅ Chat sincronizado');
  } catch (error) {
    console.error('❌ Erro ao sincronizar chat:', error);
  }
}

// ═══ ENVIAR MENSAGEM ═══
export async function sendChatMessage(
  conversationId: string,
  userId: string,
  userName: string,
  messageText: string
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: chatDb.generateUUID(),
    conversation_id: conversationId,
    user_id: userId,
    user_name: userName,
    message: messageText,
    reactions: {},
    deleted: false,
    created_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  // Salvar localmente primeiro (offline-first)
  await chatDb.saveMessage(message);

  if (isOnline) {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          id: message.id,
          conversation_id: message.conversation_id,
          user_id: message.user_id,
          user_name: message.user_name,
          message: message.message,
          reactions: message.reactions,
          deleted: message.deleted,
        });

      if (!error) {
        await chatDb.saveMessage({ ...message, pending_sync: false });
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }

  return message;
}

// ═══ ADICIONAR REAÇÃO ═══
export async function addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
  const message = await chatDb.getMessage(messageId);
  if (!message) return;

  const reactions = { ...message.reactions };
  reactions[emoji] = (reactions[emoji] || 0) + 1;

  await chatDb.updateMessageReactions(messageId, reactions);

  if (isOnline) {
    try {
      await supabase
        .from('chat_messages')
        .update({ reactions })
        .eq('id', messageId);
    } catch (error) {
      console.error('Erro ao adicionar reação:', error);
    }
  }
}

// ═══ REMOVER REAÇÃO ═══
export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  const message = await chatDb.getMessage(messageId);
  if (!message) return;

  const reactions = { ...message.reactions };
  if (reactions[emoji] && reactions[emoji] > 0) {
    reactions[emoji] = reactions[emoji] - 1;
    if (reactions[emoji] === 0) {
      delete reactions[emoji];
    }
  }

  await chatDb.updateMessageReactions(messageId, reactions);

  if (isOnline) {
    try {
      await supabase
        .from('chat_messages')
        .update({ reactions })
        .eq('id', messageId);
    } catch (error) {
      console.error('Erro ao remover reação:', error);
    }
  }
}

// ═══ DELETAR MENSAGEM (LÓGICO) ═══
export async function deleteMessage(messageId: string): Promise<void> {
  await chatDb.markMessageDeleted(messageId);

  if (isOnline) {
    try {
      await supabase
        .from('chat_messages')
        .update({ deleted: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
    }
  }
}

// ═══ CRIAR CONVERSA PRIVADA ═══
export async function createPrivateConversation(
  currentUserId: string,
  currentUserName: string,
  otherUserId: string,
  otherUserName: string
): Promise<ChatConversation> {
  // Verificar se já existe
  const existing = await chatDb.findPrivateConversation(currentUserId, otherUserId);
  if (existing) return existing;

  const conversation: ChatConversation = {
    id: chatDb.generateUUID(),
    type: 'private',
    created_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  await chatDb.saveConversation(conversation);

  // Adicionar participantes
  const participant1: ChatParticipant = {
    id: chatDb.generateUUID(),
    conversation_id: conversation.id,
    user_id: currentUserId,
    user_name: currentUserName,
    created_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  const participant2: ChatParticipant = {
    id: chatDb.generateUUID(),
    conversation_id: conversation.id,
    user_id: otherUserId,
    user_name: otherUserName,
    created_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  await chatDb.saveParticipant(participant1);
  await chatDb.saveParticipant(participant2);

  if (isOnline) {
    try {
      await supabase.from('chat_conversations').insert({
        id: conversation.id,
        type: conversation.type,
      });

      await supabase.from('chat_participants').insert([
        { id: participant1.id, conversation_id: conversation.id, user_id: participant1.user_id },
        { id: participant2.id, conversation_id: conversation.id, user_id: participant2.user_id },
      ]);
    } catch (error) {
      console.error('Erro ao criar conversa privada:', error);
    }
  }

  return conversation;
}

// ═══ DELETAR CONVERSA ═══
export async function deleteConversation(conversationId: string): Promise<void> {
  await chatDb.deleteConversation(conversationId);

  if (isOnline) {
    try {
      await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId);
    } catch (error) {
      console.error('Erro ao deletar conversa:', error);
    }
  }
}

// ═══ DOWNLOAD DO CLOUD ═══
export async function downloadChatFromCloud(): Promise<void> {
  if (!isOnline) return;

  try {
    // Download conversas
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('*');

    if (conversations) {
      for (const conv of conversations) {
        await chatDb.saveConversation({
          id: conv.id,
          type: conv.type as 'global' | 'private',
          created_at: conv.created_at,
        });
      }
    }

    // Download participantes
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('*, app_users(name)');

    if (participants) {
      for (const part of participants) {
        await chatDb.saveParticipant({
          id: part.id,
          conversation_id: part.conversation_id,
          user_id: part.user_id,
          user_name: (part.app_users as { name: string } | null)?.name,
          created_at: part.created_at,
        });
      }
    }

    // Download mensagens recentes
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (messages) {
      await chatDb.bulkSaveMessages(messages.map(m => ({
        id: m.id,
        conversation_id: m.conversation_id || chatDb.GLOBAL_CONVERSATION_ID,
        user_id: m.user_id || '',
        user_name: m.user_name,
        message: m.message,
        reactions: (m.reactions as Record<string, number>) || {},
        deleted: m.deleted || false,
        created_at: m.created_at || new Date().toISOString(),
        pending_sync: false,
      })));
    }

    console.log('✅ Chat baixado do cloud');
  } catch (error) {
    console.error('❌ Erro ao baixar chat:', error);
  }
}

// ═══ FORÇAR RESSINCRONIZAÇÃO ═══
export async function forceResync(conversationId: string): Promise<void> {
  if (!isOnline) return;

  try {
    // Limpar mensagens locais
    await chatDb.clearConversationHistory(conversationId);

    // Baixar do cloud
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (messages) {
      await chatDb.bulkSaveMessages(messages.map(m => ({
        id: m.id,
        conversation_id: m.conversation_id || conversationId,
        user_id: m.user_id || '',
        user_name: m.user_name,
        message: m.message,
        reactions: (m.reactions as Record<string, number>) || {},
        deleted: m.deleted || false,
        created_at: m.created_at || new Date().toISOString(),
        pending_sync: false,
      })));
    }

    console.log('✅ Conversa ressincronizada');
  } catch (error) {
    console.error('❌ Erro ao ressincronizar:', error);
  }
}

// ═══ REALTIME SUBSCRIPTION ═══
export function subscribeToChatRealtime(
  conversationId: string,
  onNewMessage: (message: ChatMessage) => void,
  onMessageUpdate: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat-${conversationId}`)
    .on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      async (payload) => {
        if (payload.new) {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            user_id: string | null;
            user_name: string;
            message: string;
            reactions: Record<string, number> | null;
            deleted: boolean;
            created_at: string;
          };
          
          const newMsg: ChatMessage = {
            id: msg.id,
            conversation_id: msg.conversation_id || conversationId,
            user_id: msg.user_id || '',
            user_name: msg.user_name,
            message: msg.message,
            reactions: msg.reactions || {},
            deleted: msg.deleted || false,
            created_at: msg.created_at,
            pending_sync: false,
          };

          await chatDb.saveMessage(newMsg);
          onNewMessage(newMsg);
        }
      }
    )
    .on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      async (payload) => {
        if (payload.new) {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            user_id: string | null;
            user_name: string;
            message: string;
            reactions: Record<string, number> | null;
            deleted: boolean;
            created_at: string;
          };
          
          const updatedMsg: ChatMessage = {
            id: msg.id,
            conversation_id: msg.conversation_id || conversationId,
            user_id: msg.user_id || '',
            user_name: msg.user_name,
            message: msg.message,
            reactions: msg.reactions || {},
            deleted: msg.deleted || false,
            created_at: msg.created_at,
            pending_sync: false,
          };

          await chatDb.saveMessage(updatedMsg);
          onMessageUpdate(updatedMsg);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
