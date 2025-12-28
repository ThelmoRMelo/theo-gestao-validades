import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RefreshCw, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatSecretMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteConversation: () => void;
  onClearHistory: () => void;
  onForceResync: () => void;
  conversationType: 'global' | 'private';
}

const ChatSecretMenu = ({
  isOpen,
  onClose,
  onDeleteConversation,
  onClearHistory,
  onForceResync,
  conversationType,
}: ChatSecretMenuProps) => {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const handleAction = (action: string) => {
    if (confirmAction === action) {
      // Executar ação
      switch (action) {
        case 'delete':
          onDeleteConversation();
          break;
        case 'clear':
          onClearHistory();
          break;
        case 'resync':
          onForceResync();
          break;
      }
      setConfirmAction(null);
      onClose();
    } else {
      setConfirmAction(action);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-foreground">
              🔒 Menu Secreto
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-muted/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            Ações avançadas de administração do chat.
          </p>

          <div className="space-y-3">
            {/* Forçar Ressincronização */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => handleAction('resync')}
            >
              <RefreshCw className="w-5 h-5 text-cyan" />
              <span>
                {confirmAction === 'resync' ? 'Clique para confirmar' : 'Forçar Ressincronização'}
              </span>
            </Button>

            {/* Limpar Histórico */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => handleAction('clear')}
            >
              <History className="w-5 h-5 text-yellow" />
              <span>
                {confirmAction === 'clear' ? 'Clique para confirmar' : 'Limpar Histórico Local'}
              </span>
            </Button>

            {/* Excluir Conversa (apenas para privadas) */}
            {conversationType === 'private' && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                onClick={() => handleAction('delete')}
              >
                <Trash2 className="w-5 h-5" />
                <span>
                  {confirmAction === 'delete' ? 'Clique para confirmar' : 'Excluir Conversa'}
                </span>
              </Button>
            )}
          </div>

          {confirmAction && (
            <p className="text-xs text-center text-muted-foreground">
              Clique novamente para confirmar a ação
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatSecretMenu;
