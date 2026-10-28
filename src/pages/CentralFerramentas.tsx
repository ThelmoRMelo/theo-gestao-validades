import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, MessageCircle, Vote, Gift } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useChatUnread } from '@/hooks/useChatUnread';

const CentralFerramentas = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const { unreadCount } = useChatUnread(user?.cloud_user_id || user?.local_user_id);

  const tools = [
    { title: 'Chat Inteligente', desc: 'Acesse o chat e continue suas conversas.', icon: MessageCircle, color: 'green', path: '/chat', badge: unreadCount },
    { title: 'Urna CIPA', desc: 'Gerencie eleições da CIPA e organize a votação dos colaboradores.', icon: Vote, color: 'cyan', path: '/ferramentas/urna-cipa', badge: 0 },
    { title: 'Sorteios & Prêmios', desc: 'Organize sorteios de brindes, números e prêmios para seus eventos.', icon: Gift, color: 'orange', path: '/ferramentas/sorteios', badge: 0 },
  ];

  return (
    <div className="min-h-screen pb-8">
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Central de Ferramentas
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Encontre aqui as ferramentas disponíveis para comunicação, eleições e sorteios.
          </p>
        </div>
      </header>

      <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(({ title, desc, icon: Icon, color, path, badge }) => (
          <div key={title} onClick={() => navigate(path)} className={`action-card ${color === 'cyan' ? '' : color}`}>
            <div className="gradient-border-card-inner flex flex-col items-center justify-center gap-3 min-h-[160px] text-center">
              <div className={`icon-circle w-16 h-16 rounded-full border-2 border-${color} flex items-center justify-center relative`}>
                <Icon className={`w-8 h-8 text-${color}`} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-coral text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="font-medium text-foreground">{title}</span>
              <span className="text-xs text-muted-foreground px-2">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CentralFerramentas;
