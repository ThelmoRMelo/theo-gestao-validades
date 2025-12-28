/**
 * Hook para gerenciar contagem de mensagens não lidas do chat
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GLOBAL_CONVERSATION_ID } from '@/lib/chatDb';
import { 
  getLastReadGlobalTimestamp, 
  setLastReadGlobalTimestamp,
  notifyNewMessage,
  playMessageSound 
} from '@/lib/chatNotifications';

export function useChatUnread(currentUserId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const checkUnreadCount = useCallback(async () => {
    const lastRead = getLastReadGlobalTimestamp();
    
    try {
      let query = supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', GLOBAL_CONVERSATION_ID)
        .eq('deleted', false);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      // Excluir mensagens próprias se tivermos o userId
      if (currentUserId) {
        query = query.neq('user_id', currentUserId);
      }

      const { count } = await query;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Erro ao verificar mensagens não lidas:', error);
    }
  }, [currentUserId]);

  const markAsRead = useCallback(() => {
    setLastReadGlobalTimestamp(new Date().toISOString());
    setUnreadCount(0);
  }, []);

  const setChatOpen = useCallback((isOpen: boolean) => {
    setIsChatOpen(isOpen);
    if (isOpen) {
      markAsRead();
    }
  }, [markAsRead]);

  useEffect(() => {
    checkUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('chat-unread-global')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `conversation_id=eq.${GLOBAL_CONVERSATION_ID}`
        },
        (payload) => {
          const newMsg = payload.new as { 
            user_id: string | null; 
            user_name: string; 
            message: string 
          };
          
          const isOwnMessage = currentUserId && newMsg.user_id === currentUserId;

          if (isChatOpen) {
            // Chat aberto - marcar como lida e tocar som
            markAsRead();
            if (!isOwnMessage) {
              playMessageSound();
            }
          } else {
            // Chat fechado - incrementar contador e notificar
            if (!isOwnMessage) {
              setUnreadCount(prev => prev + 1);
              notifyNewMessage(
                newMsg.user_name, 
                newMsg.message, 
                false, 
                false
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkUnreadCount, currentUserId, isChatOpen, markAsRead]);

  return { 
    unreadCount, 
    markAsRead, 
    setChatOpen,
    isChatOpen,
    refreshUnread: checkUnreadCount 
  };
}
