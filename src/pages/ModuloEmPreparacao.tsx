import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Vote, Gift, Clock, Target, ShoppingCart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  variant: 'urna' | 'sorteios' | 'metas';
}

const content = {
  urna: {
    title: 'Urna CIPA',
    icon: Vote,
    color: 'cyan',
    desc: 'Módulo destinado à organização das eleições da CIPA: cadastro de candidatos, votação dos colaboradores e apuração dos resultados.',
  },
  sorteios: {
    title: 'Sorteios & Prêmios',
    icon: Gift,
    color: 'orange',
    desc: 'Módulo destinado à organização de sorteios de brindes, números da sorte e prêmios para eventos da equipe.',
  },
  metas: {
    title: 'Gestão de Metas',
    icon: Target,
    color: 'yellow',
    desc: 'Configure metas mensais, distribua por setores e acompanhe as vendas.',
  },
};

const ModuloEmPreparacao = ({ variant }: Props) => {
  const navigate = useNavigate();
  const { title, icon: Icon, color, desc } = content[variant];

  return (
    <div className="min-h-screen pb-8">
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/ferramentas')} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </h1>
      </header>

      <div className="px-4 max-w-xl mx-auto">
        {variant === 'metas' ? (
          <div className="glass-card p-4">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-yellow" />
              Gestão de Metas
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{desc}</p>
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
        ) : (
          <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <div className={`w-20 h-20 rounded-full border-2 border-${color} flex items-center justify-center`}>
              <Icon className={`w-10 h-10 text-${color}`} />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{desc}</p>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow text-yellow text-xs font-medium">
              <Clock className="w-3 h-3" />
              Módulo em preparação
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuloEmPreparacao;
