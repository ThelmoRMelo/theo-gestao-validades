import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MoreVertical, Trash2 } from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import type { ChatMessage } from '@/lib/chatDb';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReaction: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  canDelete?: boolean;
}

const MessageBubble = ({ message, isOwn, onReaction, onDelete, canDelete }: MessageBubbleProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  // Mensagem deletada
  if (message.deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
          <div className="px-4 py-2 rounded-2xl bg-muted/50 italic text-muted-foreground">
            <p className="text-sm">🚫 Mensagem removida</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} relative group`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowReactions(true);
      }}
    >
      <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center">
              <User className="w-3 h-3 text-cyan" />
            </div>
            <span className="text-xs text-cyan font-medium">{message.user_name}</span>
          </div>
        )}
        
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-primary text-primary-foreground rounded-tr-none'
                : 'glass-card rounded-tl-none'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
            
            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {formatTime(message.created_at)}
              </span>
              {message.pending_sync && (
                <span className="text-xs text-yellow">⏳</span>
              )}
            </div>
          </motion.div>

          {/* Reações */}
          {hasReactions && (
            <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(message.id, emoji)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary text-xs hover:bg-secondary/80 transition-colors"
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground">{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Menu de opções (desktop) */}
          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-full hover:bg-muted/50"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-50"
                >
                  <button
                    onClick={() => {
                      setShowReactions(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2"
                  >
                    😀 Reagir
                  </button>
                  {canDelete && isOwn && (
                    <button
                      onClick={() => {
                        onDelete?.(message.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Picker de reações */}
          {showReactions && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowReactions(false)} 
              />
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <ReactionPicker
                  onSelect={(emoji) => onReaction(message.id, emoji)}
                  onClose={() => setShowReactions(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
