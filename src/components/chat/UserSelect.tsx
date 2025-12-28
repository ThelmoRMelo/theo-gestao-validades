import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import * as chatSync from '@/lib/chatSync';
import { toast } from 'sonner';

interface AppUser {
  id: string;
  local_user_id: string;
  name: string;
  function: string;
  is_active: boolean;
}

interface UserSelectProps {
  onSelect: (conversationId: string, userName: string) => void;
  onBack: () => void;
}

const UserSelect = ({ onSelect, onBack }: UserSelectProps) => {
  const { user } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('is_active', true)
        .neq('local_user_id', user?.local_user_id || '');

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (selectedUser: AppUser) => {
    if (!user) return;

    try {
      const conversation = await chatSync.createPrivateConversation(
        user.local_user_id,
        user.name,
        selectedUser.local_user_id,
        selectedUser.name
      );

      onSelect(conversation.id, selectedUser.name);
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast.error('Erro ao criar conversa');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.function.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-primary-foreground">
            Nova Conversa
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Selecione um usuário
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuário..."
            className="input-futuristic pl-10"
          />
        </div>
      </div>

      {/* Lista de usuários */}
      <div className="flex-1 px-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          filteredUsers.map((u, index) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelectUser(u)}
              className="w-full glass-card p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {u.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {u.function}
                </p>
              </div>
            </motion.button>
          ))
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="text-center py-10">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSelect;
