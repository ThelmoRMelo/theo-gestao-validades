import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, User } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import * as db from '@/lib/db';
import { sendChatMessage } from '@/lib/sync';
import type { ChatMessage } from '@/lib/db';

const ChatGlobal = () => {
  const navigate = useNavigate();
  const { user, isOnline } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Realtime subscription
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          if (payload.new) {
            const msg = payload.new as {
              id: string;
              user_id: string | null;
              user_name: string;
              message: string;
              created_at: string;
            };
            const newMsg: ChatMessage = {
              id: msg.id,
              user_id: msg.user_id || '',
              user_name: msg.user_name,
              message: msg.message,
              created_at: msg.created_at || new Date().toISOString(),
              pending_sync: false,
            };
            
            // Salvar localmente
            await db.saveChatMessage(newMsg);
            
            // Atualizar estado
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    const localMessages = await db.getChatMessages(100);
    setMessages(localMessages);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    setIsSending(true);
    
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      await sendChatMessage(user.local_user_id, user.name, messageText);
      await loadMessages();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  const isOwnMessage = (msg: ChatMessage) => msg.user_id === user?.local_user_id;

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
      <header className="header-gradient flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat Global
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            {isOnline ? 'Online' : 'Offline - Mensagens serão enviadas ao reconectar'}
          </p>
        </div>
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
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOwnMessage(msg) ? 'order-2' : 'order-1'}`}>
                    {!isOwnMessage(msg) && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                        <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-cyan" />
                        </div>
                        <span className="text-xs text-cyan font-medium">{msg.user_name}</span>
                      </div>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwnMessage(msg)
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'glass-card rounded-tl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <div className={`flex items-center gap-1 mt-1 ${
                        isOwnMessage(msg) ? 'justify-end' : 'justify-start'
                      }`}>
                        <span className={`text-xs ${
                          isOwnMessage(msg) ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.pending_sync && (
                          <span className="text-xs text-yellow">⏳</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
    </div>
  );
};

export default ChatGlobal;
