import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Setor {
  id: string;
  nome: string;
}

const parseBRL = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LancarVenda = () => {
  const navigate = useNavigate();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState('');
  const [vendaHoje, setVendaHoje] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [valorMensalSemHoje, setValorMensalSemHoje] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-BR');
  const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const loadSetores = async () => {
      const { data } = await supabase
        .from('metas_setores')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (data) setSetores(data);
    };
    loadSetores();
  }, []);

  // When sector changes, load current monthly and today values
  const loadSetorData = useCallback(async (sId: string) => {
    if (!sId) {
      setVendaHoje('');
      setValorMensal('');
      setValorMensalSemHoje(0);
      return;
    }
    setIsLoading(true);

    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();
    const diaAtual = now.getDate();
    const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
    const startDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
    const endDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}`;
    const hoje = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diaAtual).padStart(2, '0')}`;

    const { data: vendasMes } = await supabase
      .from('metas_vendas')
      .select('valor, data')
      .eq('setor_id', sId)
      .gte('data', startDate)
      .lte('data', endDate);

    let totalMes = 0;
    let totalHoje = 0;
    (vendasMes || []).forEach((v: any) => {
      const val = Number(v.valor);
      totalMes += val;
      if (v.data === hoje) totalHoje = val; // should be only one record per day
    });

    const semHoje = totalMes - totalHoje;
    setValorMensalSemHoje(semHoje);
    setVendaHoje(totalHoje > 0 ? fmtBRL(totalHoje) : '');
    setValorMensal(fmtBRL(totalMes));
    setIsLoading(false);
  }, []);

  const handleSetorChange = (sId: string) => {
    setSetorId(sId);
    loadSetorData(sId);
  };

  // When vendaHoje changes, auto-update valorMensal
  const handleVendaHojeChange = (raw: string) => {
    setVendaHoje(raw);
    const numHoje = parseBRL(raw);
    const novoMensal = valorMensalSemHoje + numHoje;
    setValorMensal(fmtBRL(novoMensal));
  };

  const handleRegistrar = async () => {
    if (!setorId) { toast.error('Selecione um setor'); return; }
    const numHoje = parseBRL(vendaHoje);
    if (numHoje < 0) { toast.error('Informe um valor válido'); return; }

    setIsSaving(true);
    try {
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();
      const diaAtual = now.getDate();
      const hoje = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diaAtual).padStart(2, '0')}`;

      // Delete today's record for this sector (overwrite)
      await supabase
        .from('metas_vendas')
        .delete()
        .eq('setor_id', setorId)
        .eq('data', hoje);

      // Insert new today's record
      if (numHoje > 0) {
        const { error } = await supabase.from('metas_vendas').insert({
          setor_id: setorId,
          valor: numHoje,
          data: hoje,
          hora: now.toTimeString().split(' ')[0],
        });
        if (error) throw error;
      }

      toast.success('Venda registrada com sucesso!');
      // Reload data for this sector
      loadSetorData(setorId);
    } catch (e) {
      toast.error('Erro ao registrar venda');
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Lançar Venda
          </h1>
          <p className="text-primary-foreground/80 text-sm">Registre vendas do dia</p>
        </div>
      </header>

      <div className="px-4 space-y-6 pb-8">
        {/* Info automática */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Data</p>
              <p className="text-foreground font-medium">{dataStr}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Hora</p>
              <p className="text-foreground font-medium">{horaStr}</p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="glass-card p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Setor</label>
            <Select value={setorId} onValueChange={handleSetorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar Setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <p className="text-xs text-muted-foreground animate-pulse">Carregando dados do setor...</p>
          )}

          {/* Valor da Venda (Mensal acumulado) */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Valor da Venda <span className="text-xs">(acumulado no mês)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={valorMensal}
                onChange={e => setValorMensal(e.target.value)}
                placeholder="0,00"
                className="text-lg font-bold text-green"
                disabled={!setorId}
              />
            </div>
          </div>

          {/* Venda de Hoje */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Venda de Hoje <span className="text-xs">(valor do dia atual)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm font-bold">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={vendaHoje}
                onChange={e => handleVendaHojeChange(e.target.value)}
                placeholder="0,00"
                className="text-lg font-bold border-primary/50 text-primary"
                disabled={!setorId}
              />
            </div>
          </div>

          <Button onClick={handleRegistrar} disabled={isSaving || !setorId} className="w-full btn-neon h-12 text-base">
            <DollarSign className="w-5 h-5 mr-2" />
            {isSaving ? 'Registrando...' : 'Registrar Venda'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LancarVenda;
