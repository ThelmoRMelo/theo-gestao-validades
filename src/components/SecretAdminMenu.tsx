import { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Users, 
  Palette, 
  Save, 
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageCircle,
  Trash2,
  Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import * as db from '@/lib/db';
import { updateAppIdentity } from '@/lib/sync';
import { toast } from 'sonner';
import type { AppIdentity } from '@/lib/db';
import { exportToBackup, importFromBackup, type ImportReport } from '@/lib/backupUtils';

interface AppUser {
  id: string;
  local_user_id: string;
  name: string;
  function: string;
  device_id: string;
  is_active: boolean;
  can_edit_others_lots: boolean;
  can_delete_lots: boolean;
  can_deactivate_products: boolean;
  can_manage_sectors: boolean;
  created_at: string;
}

const ADMIN_USER = 'Administrador';
const ADMIN_PASS = 'ADM102030';

export function SecretAdminMenu() {
  const { isOnline, triggerSync } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appIdentity, setAppIdentity] = useState<AppIdentity | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Backup states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const lastClickTime = useRef<number>(0);
  
  // Chat management states
  const [chatConversations, setChatConversations] = useState<{ id: string; type: string; created_at: string; message_count: number }[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
      loadAppIdentity();
      loadChatConversations();
    }
  }, [isAuthenticated]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUsers((data || []) as AppUser[]);
      } else {
        toast.error('É necessário estar online para gerenciar usuários');
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppIdentity = async () => {
    const identity = await db.getAppIdentity();
    if (identity) {
      setAppIdentity(identity);
      setEditTitle(identity.title);
      setEditSubtitle(identity.subtitle);
      setEditIconUrl(identity.icon_url || '');
    } else {
      setEditTitle('Sistema de controle de validades');
      setEditSubtitle('Estoque Seguro');
    }
  };

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
      console.log('Long press detected! Now double-click the title.');
    }, 10000); // 10 seconds
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTitleDoubleClick = () => {
    const now = Date.now();
    const timeDiff = now - lastClickTime.current;
    
    if (longPressTriggered && timeDiff < 300) {
      // Double click detected after long press
      setShowLoginDialog(true);
      setLongPressTriggered(false);
    }
    
    lastClickTime.current = now;
  };

  const handleLogin = () => {
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      setShowLoginDialog(false);
      setIsOpen(true);
      setUsername('');
      setPassword('');
    } else {
      toast.error('Credenciais inválidas');
    }
  };

  const handleUpdatePermission = async (
    userId: string, 
    field: keyof AppUser, 
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ [field]: value })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, [field]: value } : u)
      );
      toast.success('Permissão atualizada');
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    }
  };

  const handleSaveIdentity = async () => {
    setIsSaving(true);
    try {
      await updateAppIdentity({
        title: editTitle,
        subtitle: editSubtitle,
        icon_url: editIconUrl || undefined,
      });
      await triggerSync();
      toast.success('Identidade do app atualizada!');
    } catch (error) {
      console.error('Erro ao salvar identidade:', error);
      toast.error('Erro ao salvar identidade');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsAuthenticated(false);
    setImportReport(null);
  };

  // Backup handlers
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      await exportToBackup();
      toast.success('Backup exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportReport(null);

    try {
      const report = await importFromBackup(file);
      setImportReport(report);
      
      if (report.erros.length === 0) {
        toast.success('Importação concluída com sucesso!');
      } else {
        toast.warning('Importação concluída com alguns erros');
      }
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      toast.error('Erro ao importar backup');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Chat management functions
  const loadChatConversations = async () => {
    if (!isOnline) return;
    setIsLoadingChat(true);
    try {
      const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('id, type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Obter contagem de mensagens para cada conversa
      const conversationsWithCount = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('deleted', false);
          
          return {
            ...conv,
            message_count: count || 0
          };
        })
      );

      setChatConversations(conversationsWithCount);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast.error('Erro ao carregar conversas do chat');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleDeleteChatHistory = async (conversationId: string) => {
    if (!isOnline) {
      toast.error('É necessário estar online para esta ação');
      return;
    }

    setIsDeletingChat(conversationId);
    try {
      // Marcar todas as mensagens como deletadas (soft delete)
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted: true })
        .eq('conversation_id', conversationId);

      if (error) throw error;

      toast.success('Histórico de mensagens excluído com sucesso!');
      await loadChatConversations();
    } catch (error) {
      console.error('Erro ao excluir histórico:', error);
      toast.error('Erro ao excluir histórico de mensagens');
    } finally {
      setIsDeletingChat(null);
    }
  };

  const handleDeleteAllChatHistory = async () => {
    if (!isOnline) {
      toast.error('É necessário estar online para esta ação');
      return;
    }

    setIsDeletingChat('all');
    try {
      // Marcar todas as mensagens como deletadas
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted: true })
        .neq('deleted', true);

      if (error) throw error;

      toast.success('Todo o histórico de mensagens foi excluído!');
      await loadChatConversations();
    } catch (error) {
      console.error('Erro ao excluir histórico:', error);
      toast.error('Erro ao excluir histórico de mensagens');
    } finally {
      setIsDeletingChat(null);
    }
  };

  return (
    <>
      {/* Hidden trigger elements - these props are passed to parent */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ display: 'none' }}
      />

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
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite o usuário"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha"
                  className="mt-1 pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleLogin} className="w-full">
              Entrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Panel Dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Menu Administrativo Secreto
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="permissions" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="permissions" className="flex items-center gap-1 text-xs">
                <Users className="w-3 h-3" />
                Permissões
              </TabsTrigger>
              <TabsTrigger value="identity" className="flex items-center gap-1 text-xs">
                <Palette className="w-3 h-3" />
                Identidade
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-1 text-xs">
                <Database className="w-3 h-3" />
                Backup
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-1 text-xs">
                <MessageCircle className="w-3 h-3" />
                Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Configurações Administrativas</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadUsers}
                  disabled={!isOnline || isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {!isOnline ? (
                <div className="text-center py-8 text-muted-foreground">
                  É necessário estar online para gerenciar permissões
                </div>
              ) : isLoading ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">
                  Carregando...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.function}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Ativo</span>
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={(v) => handleUpdatePermission(user.id, 'is_active', v)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Desativar Produtos</span>
                          <Switch
                            checked={user.can_deactivate_products}
                            onCheckedChange={(v) => handleUpdatePermission(user.id, 'can_deactivate_products', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Excluir Lotes de Terceiros</span>
                          <Switch
                            checked={user.can_delete_lots}
                            onCheckedChange={(v) => handleUpdatePermission(user.id, 'can_delete_lots', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Editar Lotes de Terceiros</span>
                          <Switch
                            checked={user.can_edit_others_lots}
                            onCheckedChange={(v) => handleUpdatePermission(user.id, 'can_edit_others_lots', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Gerenciar Setores</span>
                          <Switch
                            checked={user.can_manage_sectors}
                            onCheckedChange={(v) => handleUpdatePermission(user.id, 'can_manage_sectors', v)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="identity" className="mt-4 space-y-4">
              <h3 className="font-semibold">Identidade do App</h3>
              <p className="text-sm text-muted-foreground">
                Alterações serão sincronizadas para todos os usuários
              </p>

              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título do aplicativo"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Subtítulo</Label>
                  <Input
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    placeholder="Subtítulo do aplicativo"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL do Ícone (opcional)</Label>
                  <Input
                    value={editIconUrl}
                    onChange={(e) => setEditIconUrl(e.target.value)}
                    placeholder="https://exemplo.com/icone.png"
                    className="mt-1"
                  />
                </div>

                <Button 
                  onClick={handleSaveIdentity} 
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Identidade
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="backup" className="mt-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Database className="w-4 h-4" />
                Backup e Restauração
              </h3>
              <p className="text-sm text-muted-foreground">
                Exporte e importe dados do banco local em formato Excel (.xlsx)
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportBackup}
                className="hidden"
              />

              <div className="space-y-4">
                {/* Exportar */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    <h4 className="font-medium">Exportar Backup</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gera arquivo Excel com todos os produtos e lotes do banco local.
                    Inclui duas planilhas: PRODUTOS e LOTES.
                  </p>
                  <Button 
                    onClick={handleExportBackup} 
                    disabled={isExporting}
                    className="w-full"
                    variant="outline"
                  >
                    {isExporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {isExporting ? 'Exportando...' : 'Exportar Backup'}
                  </Button>
                </div>

                {/* Importar */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-accent" />
                    <h4 className="font-medium">Importar / Restaurar</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Importa dados de um arquivo Excel de backup.
                    Produtos e lotes existentes serão atualizados; novos serão criados.
                  </p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isImporting}
                    className="w-full"
                    variant="outline"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
                  </Button>
                </div>

                {/* Relatório de Importação */}
                {importReport && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <h4 className="font-medium flex items-center gap-2">
                      {importReport.erros.length === 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-accent" />
                      )}
                      Relatório da Importação
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Produtos criados: {importReport.produtosCriados}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        <span>Produtos atualizados: {importReport.produtosAtualizados}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Lotes criados: {importReport.lotesCriados}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        <span>Lotes atualizados: {importReport.lotesAtualizados}</span>
                      </div>
                    </div>

                    {importReport.avisos.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-accent">Avisos:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {importReport.avisos.map((aviso, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                              {aviso}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {importReport.erros.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Erros ({importReport.erros.length}):</p>
                        <div className="max-h-32 overflow-y-auto">
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {importReport.erros.map((erro, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                                {erro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Chat Management Tab */}
            <TabsContent value="chat" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Gerenciar Chat
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadChatConversations}
                  disabled={!isOnline || isLoadingChat}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingChat ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Gerencie as conversas e histórico de mensagens do chat global e privado.
              </p>

              {!isOnline ? (
                <div className="text-center py-8 text-muted-foreground">
                  É necessário estar online para gerenciar o chat
                </div>
              ) : isLoadingChat ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">
                  Carregando conversas...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Botão para excluir todo o histórico */}
                  <div className="border rounded-lg p-4 space-y-3 bg-destructive/10 border-destructive/30">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-destructive" />
                      <h4 className="font-medium text-destructive">Excluir Todo o Histórico</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove todas as mensagens de todas as conversas (global e privadas).
                      Esta ação não pode ser desfeita.
                    </p>
                    <Button 
                      onClick={handleDeleteAllChatHistory}
                      disabled={isDeletingChat === 'all'}
                      className="w-full"
                      variant="destructive"
                    >
                      {isDeletingChat === 'all' ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      {isDeletingChat === 'all' ? 'Excluindo...' : 'Excluir Todo o Histórico'}
                    </Button>
                  </div>

                  {/* Lista de conversas */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {chatConversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma conversa encontrada
                      </div>
                    ) : (
                      chatConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="border rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {conv.type === 'global' ? (
                                <Globe className="w-4 h-4 text-primary" />
                              ) : (
                                <MessageCircle className="w-4 h-4 text-accent" />
                              )}
                              <span className="font-medium">
                                {conv.type === 'global' ? 'Chat Global' : 'Chat Privado'}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {conv.message_count} mensagens
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Criado em: {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          <Button
                            onClick={() => handleDeleteChatHistory(conv.id)}
                            disabled={isDeletingChat === conv.id}
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            {isDeletingChat === conv.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            {isDeletingChat === conv.id ? 'Excluindo...' : 'Excluir Histórico'}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for triggering secret menu
export function useSecretAdminTrigger() {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const lastClickTime = useRef<number>(0);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
    }, 10000); // 10 seconds
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTitleClick = () => {
    const now = Date.now();
    const timeDiff = now - lastClickTime.current;
    
    if (longPressTriggered && timeDiff < 300) {
      setShowLoginDialog(true);
      setLongPressTriggered(false);
    }
    
    lastClickTime.current = now;
  };

  return {
    longPressTriggered,
    showLoginDialog,
    setShowLoginDialog,
    iconProps: {
      onMouseDown: handleLongPressStart,
      onMouseUp: handleLongPressEnd,
      onMouseLeave: handleLongPressEnd,
      onTouchStart: handleLongPressStart,
      onTouchEnd: handleLongPressEnd,
    },
    titleProps: {
      onClick: handleTitleClick,
    },
  };
}

export default SecretAdminMenu;
