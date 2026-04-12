import { useMemo, useState } from 'react';
import { X, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SetorDetalheModalProps {
  setorId: string;
  setorNome: string;
  setorPercentual: number;
  dataSelecionada: Date;
  metaGeral: number;
  pesosMap: Record<number, number>;
  vendasRaw: { setor_id: string; valor: number; data: string }[];
  onClose: () => void;
}

const PESOS_DEFAULT: Record<number, number> = { 0: 0.5, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.1, 6: 1.2 };

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Periodo = 'diario' | 'semanal' | 'mensal';

const SetorDetalheModal = ({
  setorId, setorNome, setorPercentual, dataSelecionada, metaGeral, pesosMap, vendasRaw, onClose,
}: SetorDetalheModalProps) => {
  const [periodo, setPeriodo] = useState<Periodo>('mensal');

  const getPeso = (dow: number) => pesosMap[dow] ?? PESOS_DEFAULT[dow] ?? 1.0;

  const anoRef = dataSelecionada.getFullYear();
  const mesRef = dataSelecionada.getMonth();
  const diasNoMes = new Date(anoRef, mesRef + 1, 0).getDate();
  const diaRef = dataSelecionada.getDate();

  const metaSetor = metaGeral * (setorPercentual / 100);

  // Vendas do setor no mês, agrupadas por dia
  const vendasPorDia = useMemo(() => {
    const map = new Map<number, number>();
    const mesStr = `${anoRef}-${String(mesRef + 1).padStart(2, '0')}`;
    vendasRaw.forEach(v => {
      if (v.setor_id === setorId && v.data.startsWith(mesStr)) {
        const dia = parseInt(v.data.split('-')[2], 10);
        map.set(dia, (map.get(dia) || 0) + Number(v.valor));
      }
    });
    return map;
  }, [vendasRaw, setorId, anoRef, mesRef]);

  // Período filtering
  const periodoInfo = useMemo(() => {
    if (periodo === 'mensal') {
      return { label: `${MESES_NOMES[mesRef]} ${anoRef}`, diaInicio: 1, diaFim: diasNoMes };
    }
    if (periodo === 'semanal') {
      // Week containing dataSelecionada (Mon-Sun)
      const dow = dataSelecionada.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const diaInicio = Math.max(1, diaRef + mondayOffset);
      const diaFim = Math.min(diasNoMes, diaInicio + 6);
      return { label: `Semana do dia ${diaInicio} ao ${diaFim}`, diaInicio, diaFim };
    }
    // diario
    return { label: `Dia ${diaRef}`, diaInicio: diaRef, diaFim: diaRef };
  }, [periodo, diaRef, diasNoMes, mesRef, anoRef, dataSelecionada]);

  // Calculate cards
  const { vendidoPeriodo, metaPeriodo } = useMemo(() => {
    let vendido = 0;
    let metaP = 0;

    // Sum peso-based meta for each day in period, and vendido
    for (let d = periodoInfo.diaInicio; d <= periodoInfo.diaFim; d++) {
      const date = new Date(anoRef, mesRef, d);
      vendido += vendasPorDia.get(d) || 0;
      // Meta for this day based on weight proportion
      const peso = getPeso(date.getDay());
      // Total weight for the month
      let totalPesoMes = 0;
      for (let dd = 1; dd <= diasNoMes; dd++) {
        totalPesoMes += getPeso(new Date(anoRef, mesRef, dd).getDay());
      }
      metaP += totalPesoMes > 0 ? (peso / totalPesoMes) * metaSetor : 0;
    }
    return { vendidoPeriodo: vendido, metaPeriodo: metaP };
  }, [periodoInfo, vendasPorDia, anoRef, mesRef, diasNoMes, metaSetor, pesosMap]);

  const faltaParaMeta = Math.max(0, metaPeriodo - vendidoPeriodo);
  const resultado = vendidoPeriodo - metaPeriodo;
  const percentual = metaPeriodo > 0 ? (vendidoPeriodo / metaPeriodo) * 100 : 0;

  // Chart data (always monthly view for projection)
  const chartData = useMemo(() => {
    let totalPesoMes = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      totalPesoMes += getPeso(new Date(anoRef, mesRef, d).getDay());
    }

    let metaAcum = 0;
    let vendidoAcum = 0;
    const data: { dia: number; meta: number; vendido: number | null }[] = [];

    for (let d = 1; d <= diasNoMes; d++) {
      const peso = getPeso(new Date(anoRef, mesRef, d).getDay());
      metaAcum += totalPesoMes > 0 ? (peso / totalPesoMes) * metaSetor : 0;
      const vendaDia = vendasPorDia.get(d) || 0;
      vendidoAcum += vendaDia;
      data.push({
        dia: d,
        meta: Math.round(metaAcum),
        vendido: d <= diaRef ? Math.round(vendidoAcum) : null,
      });
    }
    return data;
  }, [diasNoMes, anoRef, mesRef, metaSetor, vendasPorDia, diaRef, pesosMap]);

  const fmtAxis = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}.000`;
    return `R$ ${v}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-2xl md:rounded-2xl w-full md:max-w-[900px] max-h-[95vh] md:max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">{setorNome}</h2>
            <p className="text-sm text-muted-foreground">
              {MESES_NOMES[mesRef]} {anoRef}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5">
          {/* Period selector */}
          <div className="flex justify-center">
            <div className="inline-flex bg-secondary rounded-lg p-1 gap-1">
              {([['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriodo(key)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                    periodo === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Meta do Setor</span>
              </div>
              <p className="text-lg font-bold text-primary">{fmt(metaPeriodo)}</p>
            </div>
            <div className="glass-card p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green" />
                <span className="text-xs text-muted-foreground">Vendido no Período</span>
              </div>
              <p className="text-lg font-bold text-green">{fmt(vendidoPeriodo)}</p>
            </div>
            <div className="glass-card p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-coral" />
                <span className="text-xs text-muted-foreground">Falta para Meta</span>
              </div>
              <p className="text-lg font-bold text-coral">{fmt(faltaParaMeta)}</p>
            </div>
            <div className="glass-card p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4" style={{ color: resultado >= 0 ? 'hsl(var(--green))' : 'hsl(var(--coral))' }} />
                <span className="text-xs text-muted-foreground">Resultado</span>
              </div>
              <p className={`text-lg font-bold ${resultado >= 0 ? 'text-green' : 'text-coral'}`}>
                {resultado >= 0 ? '+' : ''}{fmt(resultado)}
              </p>
              <p className={`text-xs ${resultado >= 0 ? 'text-green' : 'text-coral'}`}>
                {percentual >= 100 ? 'Meta atingida ✅' : `Falta ${(100 - percentual).toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Projeção - {MESES_NOMES[mesRef]} {anoRef}
            </h4>
            <div className="w-full" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                    stroke="hsl(222 30% 20%)"
                  />
                  <YAxis
                    tickFormatter={fmtAxis}
                    tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                    stroke="hsl(222 30% 20%)"
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222 47% 10%)',
                      border: '1px solid hsl(180 50% 20%)',
                      borderRadius: '8px',
                      color: 'hsl(180 100% 95%)',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [fmt(value), name === 'meta' ? 'Meta' : 'Vendido']}
                    labelFormatter={(dia) => {
                      const date = new Date(anoRef, mesRef, dia as number);
                      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                    }}
                  />
                  <Legend
                    formatter={(value) => value === 'meta' ? 'Meta' : 'Vendido'}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke="hsl(180 100% 50%)"
                    strokeWidth={2}
                    dot={{ r: 2, fill: 'hsl(180 100% 50%)' }}
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="vendido"
                    stroke="hsl(145 80% 45%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(145 80% 45%)' }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Close button (mobile) */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetorDetalheModal;
