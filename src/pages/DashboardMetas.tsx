import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Target, Trophy, AlertTriangle, BarChart3, ChevronLeft, ChevronRight, CalendarDays, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportMetasToExcel, exportMetasToPDF } from '@/lib/exportMetasUtils';
import { toast } from 'sonner';

interface SetorData {
  id: string;
  nome: string;
  percentual: number;
  meta: number;
  vendido: number;
  vendaHoje: number;
  falta: number;
  metaDiaria: number;
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const fmtDateLabel = (d: Date) => {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = MESES_NOMES[d.getMonth()];
  const semana = DIAS_SEMANA[d.getDay()];
  return `${semana}, ${dia} de ${mes}`;
};

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const DashboardMetas = () => {
  const [dataSelecionada, setDataSelecionada] = useState(() => new Date());
  const [metaGeral, setMetaGeral] = useState(0);
  const [totalVendido, setTotalVendido] = useState(0);
  const [setoresData, setSetoresData] = useState<SetorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const hoje = useMemo(() => new Date(), []);
  const isHoje = isSameDay(dataSelecionada, hoje);

  const mesRef = dataSelecionada.getMonth() + 1;
  const anoRef = dataSelecionada.getFullYear();
  const diaRef = dataSelecionada.getDate();
  const diasNoMes = new Date(anoRef, mesRef, 0).getDate();
  const diasRestantes = diasNoMes - diaRef;

  const percentualAtingido = metaGeral > 0 ? (totalVendido / metaGeral) * 100 : 0;
  const faltaParaMeta = Math.max(0, metaGeral - totalVendido);

  const vendidoHoje = setoresData.reduce((sum, s) => sum + s.vendaHoje, 0);
  const metaDoDia = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;
  const resultadoDia = vendidoHoje - metaDoDia;

  const voltarDia = () => {
    setDataSelecionada(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const avancarDia = () => {
    if (isHoje) return;
    setDataSelecionada(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      const now = new Date();
      return d > now ? now : d;
    });
  };

  const onDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const picked = new Date(e.target.value + 'T12:00:00');
    const now = new Date();
    setDataSelecionada(picked > now ? now : picked);
  };

  const loadData = useCallback(async () => {
    const { data: metaData } = await supabase
      .from('metas_mensais')
      .select('meta_total')
      .eq('ano', anoRef)
      .eq('mes', mesRef)
      .maybeSingle();

    const metaTotal = metaData ? Number(metaData.meta_total) : 0;
    setMetaGeral(metaTotal);

    const { data: setoresRaw } = await supabase
      .from('metas_setores')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    const startDate = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
    const endDate = `${anoRef}-${String(mesRef).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}`;
    const dataRef = toYMD(dataSelecionada);

    const { data: vendasRaw } = await supabase
      .from('metas_vendas')
      .select('setor_id, valor, data')
      .gte('data', startDate)
      .lte('data', endDate);

    const vendasAnterioresPorSetor = new Map<string, number>();
    const vendasDiaPorSetor = new Map<string, number>();

    (vendasRaw || []).forEach((v: any) => {
      const val = Number(v.valor);
      if (v.data === dataRef) {
        vendasDiaPorSetor.set(v.setor_id, (vendasDiaPorSetor.get(v.setor_id) || 0) + val);
      } else if (v.data < dataRef) {
        vendasAnterioresPorSetor.set(v.setor_id, (vendasAnterioresPorSetor.get(v.setor_id) || 0) + val);
      }
    });

    let total = 0;
    const allSetorIds = new Set([...vendasAnterioresPorSetor.keys(), ...vendasDiaPorSetor.keys()]);
    allSetorIds.forEach(sid => {
      total += (vendasAnterioresPorSetor.get(sid) || 0) + (vendasDiaPorSetor.get(sid) || 0);
    });
    setTotalVendido(total);

    const setoresProcessados: SetorData[] = (setoresRaw || []).map((s: any) => {
      const meta = metaTotal * (Number(s.percentual) / 100);
      const vendido = (vendasAnterioresPorSetor.get(s.id) || 0) + (vendasDiaPorSetor.get(s.id) || 0);
      const vendaHoje = vendasDiaPorSetor.get(s.id) || 0;
      const falta = Math.max(0, meta - vendido);
      const metaDiaria = diasRestantes > 0 ? falta / diasRestantes : 0;
      return { id: s.id, nome: s.nome, percentual: Number(s.percentual), meta, vendido, vendaHoje, falta, metaDiaria };
    });

    setSetoresData(setoresProcessados);
    setLoading(false);
  }, [anoRef, mesRef, diasNoMes, diasRestantes, dataSelecionada]);

  useEffect(() => {
    loadData();
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
  const alertas = setoresData.filter(s => {
    const progresso = s.meta > 0 ? (s.vendido / s.meta) * 100 : 0;
    return progresso < (diaRef / diasNoMes) * 70;
  });

  const handleExport = (format: 'excel' | 'pdf') => {
    try {
      toast.info('Exportando relatório...');
      const exportData = {
        dataSelecionada, metaGeral, totalVendido, percentualAtingido, faltaParaMeta,
        metaDoDia, vendidoHoje, resultadoDia, diasNoMes, diaRef, setoresData, ranking, alertas,
      };
      if (format === 'excel') exportMetasToExcel(exportData);
      else exportMetasToPDF(exportData);
      toast.success('Exportação concluída com sucesso!');
    } catch {
      toast.error('Falha ao gerar relatório');
    }
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
      <header className="text-center mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="w-10" />
          <h1 className="font-display text-xl font-bold text-primary">Painel de Metas</h1>
          <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              title="Exportar"
            >
              <Download className="w-5 h-5" />
            </button>
        </div>
        <p className="text-muted-foreground text-sm">
          Dia Atual: {hoje.getDate()} de {MESES_NOMES[hoje.getMonth()]}
        </p>
      </header>

      {/* Date Navigation */}
      <div className="glass-card flex items-center justify-between px-3 py-3 mb-4">
        <button
          onClick={voltarDia}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <span className="text-foreground font-semibold text-sm sm:text-base text-center flex-1 mx-2">
          {fmtDateLabel(dataSelecionada)}
        </span>

        <button
          onClick={avancarDia}
          disabled={isHoje}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <button
          onClick={() => dateInputRef.current?.showPicker()}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors ml-2"
        >
          <CalendarDays className="w-5 h-5" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          max={toYMD(hoje)}
          value={toYMD(dataSelecionada)}
          onChange={onDatePick}
        />
      </div>

      {/* Historic indicator */}
      {!isHoje && (
        <div className="text-center mb-3">
          <span className="text-xs text-yellow bg-yellow/10 border border-yellow/30 rounded-full px-3 py-1">
            📜 Visualizando histórico
          </span>
        </div>
      )}

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-3 gap-3 mb-3">
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

      {/* Meta do Dia - Row 2 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Meta do Dia</p>
          <p className="text-lg font-bold text-primary">{fmt(metaDoDia)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{isHoje ? 'Vendido Hoje' : 'Vendido no Dia'}</p>
          <p className="text-lg font-bold text-green">{fmt(vendidoHoje)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Resultado</p>
          {resultadoDia < 0 ? (
            <p className="text-lg font-bold text-coral">{fmt(resultadoDia)}</p>
          ) : (
            <p className="text-lg font-bold text-green">+{fmt(resultadoDia)}</p>
          )}
          <p className={`text-xs ${resultadoDia < 0 ? 'text-coral' : 'text-green'}`}>
            {resultadoDia < 0 ? `Faltam ${fmt(Math.abs(resultadoDia))}` : resultadoDia === 0 && metaDoDia > 0 ? 'Meta atingida ✅' : 'Acima da meta 🚀'}
          </p>
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
              percentualAtingido >= 100 ? 'bg-green' : percentualAtingido >= (diaRef / diasNoMes) * 100 ? 'bg-green' : percentualAtingido >= (diaRef / diasNoMes) * 70 ? 'bg-yellow' : 'bg-coral'
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
        <div className="overflow-x-auto scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm" style={{ minWidth: '740px' }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '140px' }}>Setor</th>
                <th className="text-right py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '120px' }}>Meta</th>
                <th className="text-right py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '120px' }}>Vendido</th>
                <th className="text-right py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '120px' }}>Falta</th>
                <th className="text-right py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '120px' }}>Meta/Dia</th>
                <th className="text-right py-2 text-muted-foreground font-medium whitespace-nowrap" style={{ minWidth: '120px' }}>{isHoje ? 'Venda/Hoje' : 'Venda/Dia'}</th>
              </tr>
            </thead>
            <tbody>
              {setoresData.map(s => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 text-foreground whitespace-nowrap">{s.nome}</td>
                  <td className="py-2 text-right text-foreground whitespace-nowrap">{fmt(s.meta)}</td>
                  <td className="py-2 text-right text-green whitespace-nowrap">{fmt(s.vendido)}</td>
                  <td className="py-2 text-right text-coral whitespace-nowrap">{fmt(s.falta)}</td>
                  <td className="py-2 text-right text-foreground whitespace-nowrap">{fmt(s.metaDiaria)}</td>
                  <td className="py-2 text-right font-bold text-primary whitespace-nowrap">{fmt(s.vendaHoje)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="glass-card p-4">
          <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-coral" /> Alertas
          </h3>
          <div className="space-y-2">
            {alertas.map(s => (
              <div key={s.id} className="p-2 rounded-lg bg-coral/10 border border-coral/30 text-sm">
                <span className="text-coral font-medium">⚠️ {s.nome}</span>
                <span className="text-muted-foreground"> está abaixo do esperado!</span>
              </div>
            ))}
            {alertas.length === 0 && (
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

export default DashboardMetas;
