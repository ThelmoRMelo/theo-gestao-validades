import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, Users, UserCheck, UserX, 
  Edit2, Save, X, RefreshCw, Database, Download, Upload,
  CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
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

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isOnline } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AppUser>>({});
  
  // Backup states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Verificar autenticação admin
    const isAdmin = sessionStorage.getItem('admin_auth');
    if (!isAdmin) {
      navigate('/admin-login');
      return;
    }

    loadUsers();
  }, [navigate]);

  const loadUsers = async () => {
    if (!isOnline) {
      toast.error('É necessário estar online para gerenciar usuários');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (user: AppUser) => {
    setEditingUser(user.id);
    setEditData({
      is_active: user.is_active,
      can_edit_others_lots: user.can_edit_others_lots,
      can_delete_lots: user.can_delete_lots,
      can_deactivate_products: user.can_deactivate_products,
      can_manage_sectors: user.can_manage_sectors,
    });
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditData({});
  };

  const saveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          is_active: editData.is_active,
          can_edit_others_lots: editData.can_edit_others_lots,
          can_delete_lots: editData.can_delete_lots,
          can_deactivate_products: editData.can_deactivate_products,
          can_manage_sectors: editData.can_manage_sectors,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Permissões atualizadas!');
      setEditingUser(null);
      setEditData({});
      loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast.error('Erro ao atualizar permissões');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    navigate('/configuracoes');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen pb-8 bg-background">
      {/* Header */}
      <header className="header-gradient py-6 px-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-primary-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Painel Administrativo
            </h1>
            <p className="text-primary-foreground/80 text-sm">
              Gerenciamento de usuários e backup
            </p>
          </div>
        </div>
        <Button
          onClick={loadUsers}
          size="sm"
          variant="outline"
          className="bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground"
          disabled={!isOnline}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </header>

      <div className="px-4">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Backup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-4 text-center">
                <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total de Usuários</p>
              </div>
              <div className="glass-card p-4 text-center">
                <UserCheck className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {users.filter(u => u.is_active).length}
                </p>
                <p className="text-xs text-muted-foreground">Usuários Ativos</p>
              </div>
            </div>

            {/* User List */}
            <div className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Usuários Registrados
              </h3>

              {isLoading ? (
                <div className="glass-card p-8 text-center">
                  <div className="animate-pulse text-muted-foreground">Carregando...</div>
                </div>
              ) : !isOnline ? (
                <div className="glass-card p-8 text-center">
                  <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Conecte-se à internet para gerenciar usuários</p>
                </div>
              ) : users.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum usuário registrado</p>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className={`glass-card p-4 border-l-4 ${
                      user.is_active ? 'border-primary' : 'border-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{user.name}</span>
                          {!user.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.function}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Desde: {formatDate(user.created_at)}
                        </p>
                      </div>

                      {editingUser === user.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveUser(user.id)}
                            className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30"
                          >
                            <Save className="w-4 h-4 text-primary" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30"
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(user)}
                          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
                        >
                          <Edit2 className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>

                    {editingUser === user.id ? (
                      <div className="space-y-3 mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Usuário Ativo</span>
                          <Switch
                            checked={editData.is_active}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Editar Lotes de Outros</span>
                          <Switch
                            checked={editData.can_edit_others_lots}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, can_edit_others_lots: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Excluir Lotes</span>
                          <Switch
                            checked={editData.can_delete_lots}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, can_delete_lots: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Desativar Produtos</span>
                          <Switch
                            checked={editData.can_deactivate_products}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, can_deactivate_products: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">Gerenciar Setores</span>
                          <Switch
                            checked={editData.can_manage_sectors}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, can_manage_sectors: checked }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {user.can_edit_others_lots && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                            Editar Outros
                          </span>
                        )}
                        {user.can_delete_lots && (
                          <span className="text-xs px-2 py-1 rounded-full bg-destructive/15 text-destructive">
                            Excluir
                          </span>
                        )}
                        {user.can_deactivate_products && (
                          <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
                            Desativar Produtos
                          </span>
                        )}
                        {user.can_manage_sectors && (
                          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                            Gerenciar Setores
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-primary" />
                Backup e Restauração
              </h3>
              <p className="text-sm text-muted-foreground">
                Exporte e importe dados do banco local em formato Excel (.xlsx)
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportBackup}
              className="hidden"
            />

            {/* Exportar */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-green" />
                <h4 className="font-medium text-foreground">Exportar Backup</h4>
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
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Backup (.xlsx)
                  </>
                )}
              </Button>
            </div>

            {/* Importar */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange" />
                <h4 className="font-medium text-foreground">Importar Backup</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Restaura dados a partir de um arquivo de backup.
                Produtos e lotes existentes serão atualizados.
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className="w-full"
                variant="outline"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo (.xlsx)
                  </>
                )}
              </Button>
            </div>

            {/* Relatório de Importação */}
            {importReport && (
              <div className="glass-card p-4 space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green" />
                  Relatório de Importação
                </h4>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-green/10">
                    <p className="text-green font-medium">{importReport.produtosCriados}</p>
                    <p className="text-xs text-muted-foreground">Produtos criados</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <p className="text-primary font-medium">{importReport.produtosAtualizados}</p>
                    <p className="text-xs text-muted-foreground">Produtos atualizados</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green/10">
                    <p className="text-green font-medium">{importReport.lotesCriados}</p>
                    <p className="text-xs text-muted-foreground">Lotes criados</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <p className="text-primary font-medium">{importReport.lotesAtualizados}</p>
                    <p className="text-xs text-muted-foreground">Lotes atualizados</p>
                  </div>
                </div>

                {importReport.erros.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="font-medium text-destructive flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4" />
                      Erros ({importReport.erros.length})
                    </p>
                    <ul className="text-xs text-destructive space-y-1 max-h-32 overflow-y-auto">
                      {importReport.erros.map((erro, i) => (
                        <li key={i}>• {erro}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importReport.avisos.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-orange/10 border border-orange/20">
                    <p className="font-medium text-orange flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Avisos ({importReport.avisos.length})
                    </p>
                    <ul className="text-xs text-orange space-y-1 max-h-32 overflow-y-auto">
                      {importReport.avisos.map((aviso, i) => (
                        <li key={i}>• {aviso}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
