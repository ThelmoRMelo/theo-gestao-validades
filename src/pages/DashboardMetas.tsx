import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Trophy, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SetorData {
  id: string;
  nome: string;
  percentual: number;
  meta: number;
  vendido: number;
  falta: number;
  metaDiaria: number;
  status: 'ok' | 'atencao' | 'risco';
}

const DashboardMetas = () => {
  const [metaGeral, setMetaGeral] = useState(0);
  const [totalVendido, setTotalVendido] = useState(0);
  const [setoresData, setSetoresData] = useState<SetorData[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const diaAtual = now.getDate();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diasRestantes = diasNoMes - diaAtual;

  const percentualAtingido = metaGeral > 0 ? (totalVendido / metaGeral) * 100 : 0;
  const faltaParaMeta = Math.max(0, metaGeral - totalVendido);
  const progressoEsperado = (diaAtual / diasNoMes) * 100;

  // Meta do Dia
  const [vendidoHoje, setVendidoHoje] = useState(0);
  const metaDoDia = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;
  const resultadoDia = vendidoHoje - metaDoDia;

  const loadData = useCallback(async () => {
    // Meta do mês
    const { data: metaData } = await supabase
      .from('metas_mensais')
      .select('meta_total')
      .eq('ano', anoAtual)
      .eq('mes', mesAtual)
      .maybeSingle();

    const metaTotal = metaData ? Number(metaData.meta_total) : 0;
    setMetaGeral(metaTotal);

    // Setores
    const { data: setoresRaw } = await supabase
      .from('metas_setores')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    // Vendas do mês
    const startDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
    const endDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}`;

    const { data: vendasRaw } = await supabase
      .from('metas_vendas')
      .select('setor_id, valor')
      .gte('data', startDate)
      .lte('data', endDate);

    // Aggregate
    const vendasPorSetor = new Map<string, number>();
    let total = 0;
    (vendasRaw || []).forEach((v: any) => {
      const val = Number(v.valor);
      total += val;
      vendasPorSetor.set(v.setor_id, (vendasPorSetor.get(v.setor_id) || 0) + val);
    });
    setTotalVendido(total);

    const setoresProcessados: SetorData[] = (setoresRaw || []).map((s: any) => {
      const meta = metaTotal * (Number(s.percentual) / 100);
      const vendido = vendasPorSetor.get(s.id) || 0;
      const falta = Math.max(0, meta - vendido);
      const metaDiaria = diasRestantes > 0 ? falta / diasRestantes : 0;
      const progresso = meta > 0 ? (vendido / meta) * 100 : 0;
      
      let status: 'ok' | 'atencao' | 'risco' = 'ok';
      if (progresso < progressoEsperado * 0.7) status = 'risco';
      else if (progresso < progressoEsperado) status = 'atencao';

      return { id: s.id, nome: s.nome, percentual: Number(s.percentual), meta, vendido, falta, metaDiaria, status };
    });

    setSetoresData(setoresProcessados);
    setLoading(false);
  }, [anoAtual, mesAtual, diasNoMes, diasRestantes, progressoEsperado]);

  useEffect(() => {
    loadData();

    // Realtime subscription
    const channel = supabase
      .channel('metas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_vendas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_mensais' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_setores' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const ranking = [...setoresData].sort((a, b) => b.vendido - a.vendido);

  const statusColor = (s: string) => {
    if (s === 'ok') return 'text-green bg-green/10 border-green/30';
    if (s === 'atencao') return 'text-yellow bg-yellow/10 border-yellow/30';
    return 'text-coral bg-coral/10 border-coral/30';
  };

  const statusIcon = (s: string) => {
    if (s === 'ok') return '✅';
    if (s === 'atencao') return '⚠️';
    return '❌';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Target className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground mt-4">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-8">
      {/* Header */}
      <header className="text-center mb-6">
        <h1 className="font-display text-xl font-bold text-primary">Painel de Metas</h1>
        <p className="text-muted-foreground text-sm">
          Dia Atual: {diaAtual} de {MESES_NOMES[mesAtual - 1]}
        </p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Meta do Mês</p>
          <p className="text-lg font-bold text-primary">{fmt(metaGeral)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Vendido</p>
          <p className="text-lg font-bold text-green">{fmt(totalVendido)}</p>
          <p className="text-xs text-green">{percentualAtingido.toFixed(1)}%</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Falta p/ Meta</p>
          <p className="text-lg font-bold text-coral">{fmt(faltaParaMeta)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Progresso Mensal</span>
          <span className="text-sm font-bold text-primary">{percentualAtingido.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentualAtingido >= 100 ? 'bg-green' : percentualAtingido >= progressoEsperado ? 'bg-green' : percentualAtingido >= progressoEsperado * 0.7 ? 'bg-yellow' : 'bg-coral'
            }`}
            style={{ width: `${Math.min(100, percentualAtingido)}%` }}
          />
        </div>
      </div>

      {/* Setores Table */}
      <div className="glass-card p-4 mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" /> Desempenho por Setor
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Setor</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Meta</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Vendido</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Falta</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Meta/Dia</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {setoresData.map(s => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 text-foreground">{s.nome}</td>
                  <td className="py-2 text-right text-foreground">{fmt(s.meta)}</td>
                  <td className="py-2 text-right text-green">{fmt(s.vendido)}</td>
                  <td className="py-2 text-right text-coral">{fmt(s.falta)}</td>
                  <td className="py-2 text-right text-foreground">{fmt(s.metaDiaria)}</td>
                  <td className="py-2 text-center">{statusIcon(s.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ranking */}
        <div className="glass-card p-4">
          <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-yellow" /> Ranking de Setores
          </h3>
          <div className="space-y-2">
            {ranking.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <span className="text-foreground">
                  <span className="font-bold text-primary mr-2">{i + 1}°</span>
                  {s.nome}
                </span>
                <span className="font-bold text-green">{fmt(s.vendido)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="glass-card p-4">
          <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-coral" /> Alertas
          </h3>
          <div className="space-y-2">
            {setoresData.filter(s => s.status === 'risco').map(s => (
              <div key={s.id} className="p-2 rounded-lg bg-coral/10 border border-coral/30 text-sm">
                <span className="text-coral font-medium">⚠️ {s.nome}</span>
                <span className="text-muted-foreground"> está abaixo do esperado!</span>
              </div>
            ))}
            {setoresData.filter(s => s.status === 'risco').length === 0 && (
              <p className="text-sm text-muted-foreground">Todos os setores estão dentro da meta 👍</p>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">Dashboard atualizado em tempo real</p>
      </footer>
    </div>
  );
};

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default DashboardMetas;
