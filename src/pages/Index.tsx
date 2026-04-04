import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Package, AlertTriangle, Plus, Search, Settings, MessageCircle, Shield, Trash2, X, Check, Target } from 'lucide-react';
import * as db from '@/lib/db';
import type { AppIdentity } from '@/lib/db';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Users, Palette, Save, RefreshCw, Eye, EyeOff, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { updateAppIdentity } from '@/lib/sync';
import { toast } from 'sonner';
import { useChatUnread } from '@/hooks/useChatUnread';

const ADMIN_USER = 'Administrador';
const ADMIN_PASS = 'ADM102030';

interface AppUser {
  id: string;
  local_user_id: string;
  name: string;
  function: string;
  is_active: boolean;
  can_edit_others_lots: boolean;
  can_delete_lots: boolean;
  can_deactivate_products: boolean;
  can_manage_sectors: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, activeLotsCount, criticalLotsCount, isOnline, isSyncing, triggerSync } = useApp();
  const [appIdentity, setAppIdentity] = useState<AppIdentity | null>(null);
  
  // Chat unread count
  const { unreadCount } = useChatUnread(user?.cloud_user_id || user?.local_user_id);

  // Secret admin menu state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const lastClickTime = useRef<number>(0);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // User editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const loadAppIdentity = async () => {
    const identity = await db.getAppIdentity();
    if (identity) {
      setAppIdentity(identity);
      setEditTitle(identity.title);
      setEditSubtitle(identity.subtitle);
    }
  };

  // Long press handlers
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
    }, 10000);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTitleClick = () => {
    const now = Date.now();
    if (longPressTriggered && now - lastClickTime.current < 300) {
      setShowLoginDialog(true);
      setLongPressTriggered(false);
    }
    lastClickTime.current = now;
  };

  const handleLogin = () => {
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setShowLoginDialog(false);
      setIsAdminOpen(true);
      loadAdminUsers();
      setUsername('');
      setPassword('');
    } else {
      toast.error('Credenciais inválidas');
    }
  };

  const loadAdminUsers = async () => {
    if (!isOnline) return;
    setIsLoadingUsers(true);
    try {
      const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
      setAdminUsers((data || []) as AppUser[]);
    } catch (e) {
      console.error(e);
    }
    setIsLoadingUsers(false);
  };

  const handleUpdatePermission = async (userId: string, field: string, value: boolean) => {
    try {
      await supabase.from('app_users').update({ [field]: value }).eq('id', userId);
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
      toast.success('Permissão atualizada');
    } catch (e) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleSaveIdentity = async () => {
    setIsSaving(true);
    await updateAppIdentity({ title: editTitle, subtitle: editSubtitle });
    await triggerSync();
    await loadAppIdentity();
    setIsSaving(false);
    toast.success('Identidade atualizada!');
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', userToDelete.id);
      
      if (error) throw error;
      
      setAdminUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      toast.success(`Usuário "${userToDelete.name}" excluído com sucesso`);
      setUserToDelete(null);
      setEditingUserId(null);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/identificacao');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 pb-8">
      {/* Header with secret trigger */}
      <header className="flex items-center gap-4 mb-8">
        <div 
          className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center cursor-pointer select-none"
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
        >
          <Package className="w-8 h-8 text-primary" />
        </div>
        <div onClick={handleTitleClick} className="cursor-pointer select-none">
          <h1 className="font-display text-xl font-bold text-primary">
            {appIdentity?.title || 'Sistema de controle de validades'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {appIdentity?.subtitle || 'Estoque Seguro'}
          </p>
        </div>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div onClick={() => navigate('/lotes-ativos')} className="stat-card cursor-pointer">
          <div className="gradient-border-card-inner flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Produtos Ativos</p>
              <p className="text-3xl font-bold text-primary">{activeLotsCount}</p>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-cyan flex items-center justify-center">
              <Package className="w-6 h-6 text-cyan" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/validades-criticas')} className="stat-card critical cursor-pointer">
          <div className="gradient-border-card-inner flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Validades Críticas</p>
              <p className="text-3xl font-bold text-coral">{criticalLotsCount}</p>
            </div>
            <div className={`w-12 h-12 rounded-full border-2 border-coral flex items-center justify-center ${criticalLotsCount > 0 ? 'animate-beacon' : ''}`}>
              <AlertTriangle className="w-6 h-6 text-coral" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div onClick={() => navigate('/cadastrar')} className="action-card">
          <div className="gradient-border-card-inner flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="icon-circle w-16 h-16 rounded-full border-2 border-cyan flex items-center justify-center">
              <Plus className="w-8 h-8 text-cyan" />
            </div>
            <span className="font-medium text-foreground">Cadastrar Produto</span>
          </div>
        </div>
        <div onClick={() => navigate('/consultar')} className="action-card orange">
          <div className="gradient-border-card-inner flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="icon-circle w-16 h-16 rounded-full border-2 border-orange flex items-center justify-center">
              <Search className="w-8 h-8 text-orange" />
            </div>
            <span className="font-medium text-foreground">Consultar Produtos</span>
          </div>
        </div>
        <div onClick={() => navigate('/configuracoes')} className="action-card yellow">
          <div className="gradient-border-card-inner flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="icon-circle w-16 h-16 rounded-full border-2 border-yellow flex items-center justify-center">
              <Settings className="w-8 h-8 text-yellow" />
            </div>
            <span className="font-medium text-foreground">Configurações</span>
          </div>
        </div>
        <div onClick={() => navigate('/chat')} className="action-card green relative">
          <div className="gradient-border-card-inner flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="icon-circle w-16 h-16 rounded-full border-2 border-green flex items-center justify-center relative">
              <MessageCircle className="w-8 h-8 text-green" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-coral text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="font-medium text-foreground">Chat Global</span>
          </div>
        </div>
      </div>


      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-muted-foreground text-sm">GestãoValidades v2.0.0 - Sistema Offline + Cloud</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green' : 'bg-coral'}`} />
          <span className="text-xs text-muted-foreground">
            {isSyncing ? 'Sincronizando...' : isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </footer>

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Acesso Administrativo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Usuário</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário" className="mt-1" />
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="mt-1 pr-10" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleLogin} className="w-full">Entrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Panel Dialog */}
      <Dialog open={isAdminOpen} onOpenChange={setIsAdminOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Menu Administrativo Secreto
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="permissions" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="permissions"><Users className="w-4 h-4 mr-2" />Permissões</TabsTrigger>
              <TabsTrigger value="identity"><Palette className="w-4 h-4 mr-2" />Identidade</TabsTrigger>
            </TabsList>
            <TabsContent value="permissions" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Usuários</h3>
                <Button size="sm" variant="outline" onClick={loadAdminUsers} disabled={isLoadingUsers}>
                  <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {adminUsers.map((u) => (
                <div key={u.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">{u.name} <span className="text-sm text-muted-foreground">({u.function})</span></div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setEditingUserId(editingUserId === u.id ? null : u.id)}
                      className="h-8 w-8"
                    >
                      {editingUserId === u.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  {editingUserId === u.id && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="grid gap-2">
                        {[
                          { field: 'is_active', label: 'Ativo' },
                          { field: 'can_deactivate_products', label: 'Desativar Produtos' },
                          { field: 'can_delete_lots', label: 'Excluir Lotes Terceiros' },
                          { field: 'can_edit_others_lots', label: 'Editar Lotes Terceiros' },
                          { field: 'can_manage_sectors', label: 'Gerenciar Setores' },
                        ].map(({ field, label }) => (
                          <div key={field} className="flex justify-between items-center">
                            <span className="text-sm text-foreground">{label}</span>
                            <Switch checked={u[field as keyof AppUser] as boolean} onCheckedChange={(v) => handleUpdatePermission(u.id, field, v)} />
                          </div>
                        ))}
                      </div>
                      
                      {/* Botões de ação */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setUserToDelete(u)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingUserId(null)}
                          className="flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Concluir
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="identity" className="mt-4 space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleSaveIdentity} disabled={isSaving} className="w-full">
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>"{userToDelete?.name}"</strong>?
              <br /><br />
              Esta ação é <strong>permanente</strong> e não pode ser desfeita. O usuário será removido de todos os dispositivos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir Usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
