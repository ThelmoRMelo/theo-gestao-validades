import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, ShoppingCart, Check } from 'lucide-react';
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

const LancarVenda = () => {
  const navigate = useNavigate();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState('');
  const [valor, setValor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleRegistrar = async () => {
    if (!setorId) { toast.error('Selecione um setor'); return; }
    const numVal = parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    if (numVal <= 0) { toast.error('Informe um valor válido'); return; }

    setIsSaving(true);
    try {
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();
      const startDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const lastDay = new Date(anoAtual, mesAtual, 0).getDate();
      const endDate = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Remove lançamento anterior do mesmo setor no mês atual
      await supabase
        .from('metas_vendas')
        .delete()
        .eq('setor_id', setorId)
        .gte('data', startDate)
        .lte('data', endDate);

      // Insere novo lançamento
      const { error } = await supabase.from('metas_vendas').insert({
        setor_id: setorId,
        valor: numVal,
        data: now.toISOString().split('T')[0],
        hora: now.toTimeString().split(' ')[0],
      });

      if (error) throw error;

      toast.success('Venda registrada com sucesso! (valor anterior substituído)');
      setValor('');
      setSetorId('');
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
            <Select value={setorId} onValueChange={setSetorId}>
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

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Valor da Venda</label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className="text-lg font-bold"
              />
            </div>
          </div>

          <Button onClick={handleRegistrar} disabled={isSaving} className="w-full btn-neon h-12 text-base">
            <DollarSign className="w-5 h-5 mr-2" />
            {isSaving ? 'Registrando...' : 'Registrar Venda'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LancarVenda;
