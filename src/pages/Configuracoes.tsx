import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Palette, Download, RefreshCw, 
  User, Shield, ChevronRight, Smartphone, Wifi, WifiOff, Bell, BellOff,
  FileSpreadsheet, Target, ShoppingCart
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import * as db from '@/lib/db';
import { requestNotificationPermission, areNotificationsEnabled, setNotificationsEnabled } from '@/lib/notifications';
import { exportToExcel } from '@/lib/exportUtils';

const themes = [
  { id: 'future', name: 'Future Design', description: 'Tema padrão futurista', color: '180 100% 50%' },
  { id: 'ocean', name: 'Ocean Depth', description: 'Azul profundo oceânico', color: '200 100% 55%' },
  { id: 'neon', name: 'Neon Nights', description: 'Rosa neon vibrante', color: '320 100% 60%' },
  { id: 'emerald', name: 'Emerald Tech', description: 'Verde esmeralda elegante', color: '145 80% 50%' },
  { id: 'sunset', name: 'Sunset Warm', description: 'Laranja quente acolhedor', color: '25 100% 55%' },
];

const Configuracoes = () => {
  const navigate = useNavigate();
  const { user, theme, setTheme, isOnline, isSyncing, triggerSync } = useApp();
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);

  useEffect(() => {
    setNotificationsEnabledState(areNotificationsEnabled());
  }, []);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        setNotificationsEnabledState(true);
        toast.success('Notificações ativadas!');
      } else {
        toast.error('Permissão de notificações negada');
      }
    } else {
      setNotificationsEnabled(false);
      setNotificationsEnabledState(false);
      toast.info('Notificações desativadas');
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('Sem conexão com internet');
      return;
    }
    await triggerSync();
    toast.success('Sincronização concluída!');
  };

  const exportAllData = async () => {
    const [produtos, lots] = await Promise.all([
      db.getAllProdutos(),
      db.getAllLots(),
    ]);

    const produtoMap = new Map(produtos.map(p => [p.barcode, p]));
    
    const headers = ['Produto', 'Código de Barras', 'Setor', 'Validade', 'Quantidade', 'Status', 'Dias Restantes'];
    const rows = lots.map(lot => {
      const produto = produtoMap.get(lot.barcode);
      const today = new Date();
      const expDate = new Date(lot.expiration_date + 'T00:00:00');
      const days = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return [
        produto?.name || 'Desconhecido',
        lot.barcode,
        produto?.sector || 'Geral',
        new Date(lot.expiration_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        lot.quantity.toString(),
        lot.status === 'active' ? 'Ativo' : 'Desativado',
        days.toString(),
      ];
    });

    exportToExcel(
      { headers, rows, title: 'Gestão de Validades' },
      `gestao-validades-${new Date().toISOString().split('T')[0]}`
    );

    toast.success('Dados exportados com sucesso!');
  };

  const handleAdminClick = () => {
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);
    
    if (newCount >= 5) {
      navigate('/admin-login');
      setAdminClickCount(0);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Personalize seu aplicativo
          </p>
        </div>
      </header>

      <div className="px-4 space-y-6">
        {/* Usuário */}
        <div className="glass-card p-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-cyan" />
            Meu Perfil
          </h3>
          {user && (
            <div className="space-y-2">
              <p className="text-foreground">
                <span className="text-muted-foreground">Nome: </span>
                {user.name}
              </p>
              <p className="text-foreground">
                <span className="text-muted-foreground">Função: </span>
                {user.function}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  ID: {user.device_id.slice(0, 20)}...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Status da Conexão */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green" />
              ) : (
                <WifiOff className="w-5 h-5 text-coral" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOnline 
                    ? 'Conectado ao servidor' 
                    : 'Trabalhando localmente'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
              size="sm"
              className="btn-neon"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando' : 'Sincronizar'}
            </Button>
          </div>
        </div>

        {/* Temas */}
        <div className="glass-card p-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-purple" />
            Temas
          </h3>
          <div className="space-y-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                  theme === t.id 
                    ? 'bg-primary/20 border-2 border-primary' 
                    : 'bg-secondary hover:bg-secondary/80 border-2 border-transparent'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-full"
                  style={{ background: `hsl(${t.color})` }}
                />
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {theme === t.id && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground">
                    Ativo
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notificações */}
        <div className="glass-card p-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            {notificationsEnabled ? (
              <Bell className="w-5 h-5 text-green" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            Notificações Push
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Alertas de Validade</p>
              <p className="text-sm text-muted-foreground">
                Receba notificações sobre produtos próximos do vencimento
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
            />
          </div>
        </div>

        {/* Exportar Dados */}
        <div className="glass-card p-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-orange" />
            Exportar Dados
          </h3>
          <Button
            onClick={exportAllData}
            className="w-full btn-secondary"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar para Excel (.xlsx)
          </Button>
        </div>

        {/* Gestão de Metas */}
        <div className="glass-card p-4">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-yellow" />
            Gestão de Metas
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Configure metas mensais e distribuição por setores</p>
          <div className="space-y-2">
            <Button onClick={() => navigate('/gestao-metas')} className="w-full btn-secondary">
              <Target className="w-4 h-4 mr-2" /> Configurar Metas
            </Button>
            <Button onClick={() => navigate('/lancar-venda')} className="w-full btn-secondary">
              <ShoppingCart className="w-4 h-4 mr-2" /> Lançar Venda
            </Button>
            <Button onClick={() => window.open('/metas', '_blank')} variant="outline" className="w-full">
              <ChevronRight className="w-4 h-4 mr-2" /> Abrir Dashboard de Metas
            </Button>
          </div>
        </div>

        {/* Admin Secret (invisível) */}
        <div 
          onClick={handleAdminClick}
          className="glass-card p-4 cursor-default"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Versão do App</p>
                <p className="text-sm text-muted-foreground">v2.0.0 - Offline First</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
