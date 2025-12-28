import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, Wifi, WifiOff, Bell, BellOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import MessageBubble from './MessageBubble';
import ChatSecretMenu from './ChatSecretMenu';
import * as chatDb from '@/lib/chatDb';
import * as chatSync from '@/lib/chatSync';
import { 
  requestChatNotificationPermission, 
  playMessageSound,
  getChatNotificationSettings,
  saveChatNotificationSettings
} from '@/lib/chatNotifications';
import type { ChatMessage, ChatConversation } from '@/lib/chatDb';

interface ChatRoomProps {
  conversationId: string;
  conversationType: 'global' | 'private';
  title: string;
  onBack?: () => void;
}

const ChatRoom = ({ conversationId, conversationType, title, onBack }: ChatRoomProps) => {
  const navigate = useNavigate();
  const { user, isOnline } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSecretMenu, setShowSecretMenu] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(getChatNotificationSettings().soundEnabled);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Para ativar menu secreto
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = user?.cloud_user_id || user?.local_user_id;

  const loadMessages = useCallback(async () => {
    const msgs = await chatDb.getMessages(conversationId, 200);
    setMessages(msgs);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
    
    // Solicitar permissão de notificação
    requestChatNotificationPermission();

    // Subscribe to realtime updates
    const unsubscribe = chatSync.subscribeToChatRealtime(
      conversationId,
      (newMsg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          // Tocar som se não for mensagem própria
          if (newMsg.user_id !== currentUserId) {
            playMessageSound();
          }
          return [...prev, newMsg];
        });
      },
      (updatedMsg) => {
        setMessages(prev => 
          prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
        );
      }
    );

    return unsubscribe;
  }, [conversationId, loadMessages, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Usar cloud_user_id se disponível (para FK), senão local_user_id como fallback
      const userId = user.cloud_user_id || user.local_user_id;
      const msg = await chatSync.sendChatMessage(
        conversationId,
        userId,
        user.name,
        messageText
      );

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const userId = user?.cloud_user_id || user?.local_user_id || '';
    await chatSync.addReaction(messageId, emoji, userId);
    await loadMessages();
  };

  const handleDeleteMessage = async (messageId: string) => {
    await chatSync.deleteMessage(messageId);
    await loadMessages();
    toast.success('Mensagem removida');
  };

  // Ativação do menu secreto
  const handleHeaderLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setShowSecretMenu(true);
    }, 5000);
  };

  const handleHeaderPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTitleTap = () => {
    tapCount.current += 1;
    
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    if (tapCount.current >= 3) {
      setShowSecretMenu(true);
      tapCount.current = 0;
    } else {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 500);
    }
  };

  const handleDeleteConversation = async () => {
    await chatSync.deleteConversation(conversationId);
    toast.success('Conversa excluída');
    onBack ? onBack() : navigate('/chat');
  };

  const handleClearHistory = async () => {
    await chatDb.clearConversationHistory(conversationId);
    setMessages([]);
    toast.success('Histórico local limpo');
  };

  const handleForceResync = async () => {
    await chatSync.forceResync(conversationId);
    await loadMessages();
    toast.success('Conversa ressincronizada');
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    saveChatNotificationSettings({ soundEnabled: newValue });
    toast.success(newValue ? 'Som ativado' : 'Som desativado');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  // Agrupar mensagens por data
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header 
        className="header-gradient flex items-center gap-4"
        onTouchStart={handleHeaderLongPress}
        onTouchEnd={handleHeaderPressEnd}
        onMouseDown={handleHeaderLongPress}
        onMouseUp={handleHeaderPressEnd}
        onMouseLeave={handleHeaderPressEnd}
      >
        <button 
          onClick={() => onBack ? onBack() : navigate('/')}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex-1" onClick={handleTitleTap}>
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {title}
          </h1>
          <p className="text-primary-foreground/80 text-sm flex items-center gap-1">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3" /> Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" /> Offline - Mensagens serão enviadas ao reconectar
              </>
            )}
          </p>
        </div>
        <button
          onClick={toggleSound}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
          title={soundEnabled ? 'Desativar som' : 'Ativar som'}
        >
          {soundEnabled ? (
            <Bell className="w-5 h-5 text-primary-foreground" />
          ) : (
            <BellOff className="w-5 h-5 text-primary-foreground/50" />
          )}
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex justify-center mb-4">
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                {date}
              </span>
            </div>
            
            <div className="space-y-3">
              {msgs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user_id === (user?.cloud_user_id || user?.local_user_id)}
                  onReaction={handleReaction}
                  onDelete={handleDeleteMessage}
                  canDelete={msg.user_id === (user?.cloud_user_id || user?.local_user_id)}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 glass-card rounded-none border-t border-border">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="input-futuristic flex-1"
            disabled={isSending}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="btn-neon px-4"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>

      {/* Menu Secreto */}
      <ChatSecretMenu
        isOpen={showSecretMenu}
        onClose={() => setShowSecretMenu(false)}
        onDeleteConversation={handleDeleteConversation}
        onClearHistory={handleClearHistory}
        onForceResync={handleForceResync}
        conversationType={conversationType}
      />
    </div>
  );
};

export default ChatRoom;
