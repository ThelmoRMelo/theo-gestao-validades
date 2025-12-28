import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Users, Plus, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import * as chatDb from '@/lib/chatDb';
import * as chatSync from '@/lib/chatSync';
import type { ChatConversation, ChatParticipant } from '@/lib/chatDb';

interface ConversationWithDetails extends ChatConversation {
  participants?: ChatParticipant[];
  lastMessage?: string;
  unreadCount?: number;
}

interface ChatListProps {
  onSelectConversation: (conversationId: string, type: 'global' | 'private', title: string) => void;
  onCreatePrivate: () => void;
}

const ChatList = ({ onSelectConversation, onCreatePrivate }: ChatListProps) => {
  const navigate = useNavigate();
  const { user, isOnline } = useApp();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Carregar conversa global
      const globalConv = await chatDb.getConversation(chatDb.GLOBAL_CONVERSATION_ID);
      const globalMessages = await chatDb.getMessages(chatDb.GLOBAL_CONVERSATION_ID, 1);
      
      const convList: ConversationWithDetails[] = [];
      
      if (globalConv) {
        convList.push({
          ...globalConv,
          lastMessage: globalMessages[0]?.message || 'Nenhuma mensagem ainda',
        });
      }

      // Carregar conversas privadas do usuário
      const privateConvs = await chatDb.getPrivateConversations();
      
      for (const conv of privateConvs) {
        const participants = await chatDb.getParticipants(conv.id);
        const otherParticipant = participants.find(p => p.user_id !== user.local_user_id);
        const messages = await chatDb.getMessages(conv.id, 1);
        
        convList.push({
          ...conv,
          participants,
          lastMessage: messages[0]?.message || 'Nenhuma mensagem ainda',
        });
      }

      setConversations(convList);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConversationTitle = (conv: ConversationWithDetails) => {
    if (conv.type === 'global') {
      return 'Chat Global';
    }
    
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.local_user_id);
    return otherParticipant?.user_name || 'Conversa Privada';
  };

  const getConversationIcon = (conv: ConversationWithDetails) => {
    if (conv.type === 'global') {
      return <Globe className="w-6 h-6 text-cyan" />;
    }
    return <Users className="w-6 h-6 text-primary" />;
  };

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
            Conversas
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <Button
          onClick={onCreatePrivate}
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      {/* Lista de conversas */}
      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          conversations.map((conv, index) => (
            <motion.button
              key={conv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelectConversation(conv.id, conv.type, getConversationTitle(conv))}
              className="w-full glass-card p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                {getConversationIcon(conv)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {getConversationTitle(conv)}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {conv.lastMessage}
                </p>
              </div>

              {conv.unreadCount && conv.unreadCount > 0 && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs text-primary-foreground font-bold">
                    {conv.unreadCount}
                  </span>
                </div>
              )}
            </motion.button>
          ))
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-10">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma conversa ainda</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
