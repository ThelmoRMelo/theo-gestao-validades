import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface Setor {
  id: string;
  nome: string;
  percentual: number;
  ativo: boolean;
}

const parseBRL = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const HistoricoVendasSetor = () => {
  const now = new Date();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState('');
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [metaSetor, setMetaSetor] = useState(0);
  const [diasVendas, setDiasVendas] = useState<Record<number, number>>({});
  const [rawInputs, setRawInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const diasNoMes = new Date(ano, mes, 0).getDate();
  const totalVendido = Object.values(diasVendas).reduce((s, v) => s + v, 0);
  const deficit = totalVendido - metaSetor;
  const percentual = metaSetor > 0 ? (totalVendido / metaSetor) * 100 : 0;

  // Load setores once
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('metas_setores')
        .select('id, nome, percentual, ativo')
        .eq('ativo', true)
        .order('nome');
      if (data) setSetores(data.map((s: any) => ({ ...s, percentual: Number(s.percentual) })));
    };
    load();
  }, []);

  // Load data when filters change
  const loadData = useCallback(async () => {
    if (!setorId) return;

    // Get meta do mês
    const { data: metaData } = await supabase
      .from('metas_mensais')
      .select('meta_total')
      .eq('ano', ano)
      .eq('mes', mes)
      .maybeSingle();

    const setor = setores.find(s => s.id === setorId);
    const metaTotal = metaData ? Number(metaData.meta_total) : 0;
    const metaCalc = setor ? metaTotal * (setor.percentual / 100) : 0;
    setMetaSetor(metaCalc);

    // Get vendas do mês
    const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endDate = `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`;

    const { data: vendasData } = await supabase
      .from('metas_vendas')
      .select('data, valor')
      .eq('setor_id', setorId)
      .gte('data', startDate)
      .lte('data', endDate);

    const map: Record<number, number> = {};
    (vendasData || []).forEach((v: any) => {
      const dia = parseInt(v.data.split('-')[2], 10);
      map[dia] = Number(v.valor);
    });
    setDiasVendas(map);
    setRawInputs({});
  }, [setorId, mes, ano, setores]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDiaChange = (dia: number, value: string) => {
    setRawInputs(prev => ({ ...prev, [dia]: value }));
    const num = parseBRL(value);
    setDiasVendas(prev => ({ ...prev, [dia]: num }));
  };

  const handleDiaBlur = (dia: number) => {
    const val = diasVendas[dia] || 0;
    setRawInputs(prev => ({ ...prev, [dia]: val > 0 ? fmtBRL(val) : '' }));
  };

  const handleDiaFocus = (dia: number) => {
    const val = diasVendas[dia] || 0;
    if (val > 0) {
      setRawInputs(prev => ({ ...prev, [dia]: val.toString().replace('.', ',') }));
    } else {
      setRawInputs(prev => ({ ...prev, [dia]: '' }));
    }
  };

  const getDisplay = (dia: number) => {
    if (rawInputs[dia] !== undefined) return rawInputs[dia];
    const val = diasVendas[dia] || 0;
    return val > 0 ? fmtBRL(val) : '';
  };

  const handleSave = async () => {
    if (!setorId) { toast.error('Selecione um setor'); return; }
    setIsSaving(true);
    try {
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const valor = diasVendas[dia] || 0;
        const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

        // Delete existing record for this day/sector
        await supabase
          .from('metas_vendas')
          .delete()
          .eq('setor_id', setorId)
          .eq('data', dataStr);

        // Insert if value > 0
        if (valor > 0) {
          await supabase.from('metas_vendas').insert({
            setor_id: setorId,
            valor,
            data: dataStr,
            hora: '00:00:00',
          });
        }
      }
      toast.success('Histórico salvo com sucesso!');
      loadData();
    } catch (e) {
      toast.error('Erro ao salvar histórico');
    }
    setIsSaving(false);
  };

  const progressColor = percentual >= 100 ? 'bg-green' : percentual >= 70 ? 'bg-yellow-500' : 'bg-coral';
  const currentYear = now.getFullYear();

  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="font-display text-lg font-semibold text-foreground text-center">
        Histórico de Vendas por Setor
      </h3>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Setor</label>
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              {setores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
          <Select value={mes.toString()} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
          <Select value={ano.toString()} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {setorId && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Meta e Mês</p>
              <p className="text-sm font-bold text-primary">{fmtCurrency(metaSetor)}</p>
            </div>
            <div className="rounded-lg border border-green/30 bg-green/5 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Vendido</p>
              <p className="text-sm font-bold text-green">{fmtCurrency(totalVendido)}</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${
              deficit >= 0 ? 'border-green/30 bg-green/5' : 'border-coral/30 bg-coral/5'
            }`}>
              <p className="text-[10px] text-muted-foreground">{deficit >= 0 ? 'Superávit' : 'Déficit'}</p>
              <p className={`text-sm font-bold ${deficit >= 0 ? 'text-green' : 'text-coral'}`}>
                {fmtCurrency(Math.abs(deficit))}
              </p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${Math.min(percentual, 100)}%` }}
              />
              <span className="absolute right-1 top-0 text-[9px] font-bold text-foreground leading-3">
                {percentual.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {deficit < 0 ? (
                <>Faltam <span className="font-bold text-coral">{fmtCurrency(Math.abs(deficit))}</span> para atingir a meta</>
              ) : (
                <>Acima da meta em <span className="font-bold text-green">{fmtCurrency(deficit)}</span></>
              )}
            </p>
          </div>

          {/* Tabela de dias */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[60px_1fr] gap-0 bg-muted/30 px-3 py-2 border-b border-border/50">
              <span className="text-xs font-semibold text-muted-foreground italic">Dia</span>
              <span className="text-xs font-semibold text-muted-foreground italic text-right">Valor da Venda</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(dia => (
                <div
                  key={dia}
                  className="grid grid-cols-[60px_1fr] gap-0 items-center px-3 py-1.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-sm font-medium text-foreground">
                    {String(dia).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={getDisplay(dia)}
                      onChange={e => handleDiaChange(dia, e.target.value)}
                      onBlur={() => handleDiaBlur(dia)}
                      onFocus={() => handleDiaFocus(dia)}
                      placeholder="0,00"
                      className="text-right h-8 text-sm flex-1 min-w-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botão Salvar */}
          <Button onClick={handleSave} disabled={isSaving} className="w-full btn-neon h-11">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      )}
    </div>
  );
};

export default HistoricoVendasSetor;
