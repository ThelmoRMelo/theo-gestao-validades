import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Save, Plus, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface MetaSetor {
  id: string;
  nome: string;
  percentual: number;
  ativo: boolean;
}

interface MetaMensal {
  mes: number;
  meta_total: number;
}

const GestaoMetas = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(currentYear);
  const [metas, setMetas] = useState<MetaMensal[]>(
    MESES.map((_, i) => ({ mes: i + 1, meta_total: 0 }))
  );
  const [setores, setSetores] = useState<MetaSetor[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSetorDialog, setShowSetorDialog] = useState(false);
  const [editingSetor, setEditingSetor] = useState<MetaSetor | null>(null);
  const [setorNome, setSetorNome] = useState('');
  const [setorPercentual, setSetorPercentual] = useState('');

  const totalPercentual = setores.filter(s => s.ativo).reduce((sum, s) => sum + s.percentual, 0);

  const loadData = useCallback(async () => {
    // Load metas for selected year
    const { data: metasData } = await supabase
      .from('metas_mensais')
      .select('*')
      .eq('ano', ano);

    if (metasData) {
      setMetas(MESES.map((_, i) => {
        const found = metasData.find((m: any) => m.mes === i + 1);
        return { mes: i + 1, meta_total: found ? Number(found.meta_total) : 0 };
      }));
    }

    // Load setores
    const { data: setoresData } = await supabase
      .from('metas_setores')
      .select('*')
      .order('nome');

    if (setoresData) {
      setSetores(setoresData.map((s: any) => ({
        id: s.id,
        nome: s.nome,
        percentual: Number(s.percentual),
        ativo: s.ativo,
      })));
    }
  }, [ano]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMetaChange = (mes: number, value: string) => {
    const numValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    setMetas(prev => prev.map(m => m.mes === mes ? { ...m, meta_total: numValue } : m));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSave = async () => {
    if (totalPercentual !== 100 && setores.filter(s => s.ativo).length > 0) {
      toast.error('A soma dos percentuais deve ser 100%');
      return;
    }

    setIsSaving(true);
    try {
      // Save metas
      for (const meta of metas) {
        await supabase
          .from('metas_mensais')
          .upsert(
            { ano, mes: meta.mes, meta_total: meta.meta_total },
            { onConflict: 'ano,mes' }
          );
      }

      // Save setores
      for (const setor of setores) {
        await supabase
          .from('metas_setores')
          .update({ percentual: setor.percentual, ativo: setor.ativo })
          .eq('id', setor.id);
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar');
    }
    setIsSaving(false);
  };

  const handleSaveSetor = async () => {
    const nome = setorNome.trim();
    const perc = parseFloat(setorPercentual) || 0;
    if (!nome) { toast.error('Informe o nome do setor'); return; }

    try {
      if (editingSetor) {
        await supabase.from('metas_setores').update({ nome, percentual: perc }).eq('id', editingSetor.id);
      } else {
        await supabase.from('metas_setores').insert({ nome, percentual: perc });
      }
      setShowSetorDialog(false);
      setEditingSetor(null);
      setSetorNome('');
      setSetorPercentual('');
      loadData();
      toast.success(editingSetor ? 'Setor atualizado' : 'Setor criado');
    } catch (e) {
      toast.error('Erro ao salvar setor');
    }
  };

  const openEditSetor = (s: MetaSetor) => {
    setEditingSetor(s);
    setSetorNome(s.nome);
    setSetorPercentual(s.percentual.toString());
    setShowSetorDialog(true);
  };

  const openNewSetor = () => {
    setEditingSetor(null);
    setSetorNome('');
    setSetorPercentual('');
    setShowSetorDialog(true);
  };

  const toggleSetorAtivo = async (setor: MetaSetor) => {
    await supabase.from('metas_setores').update({ ativo: !setor.ativo }).eq('id', setor.id);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4 mb-4">
        <button onClick={() => navigate('/configuracoes')} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <Target className="w-5 h-5" /> Gestão de Metas
          </h1>
          <p className="text-primary-foreground/80 text-sm">Configure metas e setores</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="btn-neon">
          <Save className="w-4 h-4 mr-1" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </header>

      <div className="px-4 space-y-6 pb-8 overflow-y-auto flex-1">
        {/* Metas Anuais */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Metas Anuais</h3>
            <Select value={ano.toString()} onValueChange={v => setAno(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {MESES.map((nome, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground w-20 shrink-0">{nome}</span>
                <div className="flex items-center gap-1 flex-1 justify-end">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={metas[i].meta_total === 0 ? '' : metas[i].meta_total.toLocaleString('pt-BR')}
                    onChange={e => handleMetaChange(i + 1, e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 text-right h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Setores e Percentuais */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Setores e Percentuais</h3>
            <Button size="sm" variant="outline" onClick={openNewSetor}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </div>

          <div className="space-y-2">
            {setores.map(s => (
              <div key={s.id} className={`flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0 ${!s.ativo ? 'opacity-50' : ''}`}>
                <span className="text-sm text-foreground flex-1">{s.nome}</span>
                <span className="text-sm font-bold text-primary">{s.percentual}%</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditSetor(s)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Switch checked={s.ativo} onCheckedChange={() => toggleSetorAtivo(s)} />
              </div>
            ))}
          </div>

          {/* Total indicator */}
          <div className={`mt-4 p-3 rounded-lg flex items-center justify-between ${
            totalPercentual === 100 ? 'bg-green/10 border border-green/30' : 'bg-coral/10 border border-coral/30'
          }`}>
            <span className="text-sm font-medium">Total:</span>
            <span className={`font-bold ${totalPercentual === 100 ? 'text-green' : 'text-coral'}`}>
              {totalPercentual}%
            </span>
          </div>
          {totalPercentual !== 100 && setores.filter(s => s.ativo).length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-coral text-xs">
              <AlertTriangle className="w-4 h-4" />
              A soma dos percentuais dos setores ativos deve ser igual a 100%
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Nota: A soma dos percentuais deve ser igual a 100%.
            As metas anuais podem ser ajustadas indefinidamente.
          </p>
        </div>
      </div>

      {/* Dialog Setor */}
      <Dialog open={showSetorDialog} onOpenChange={setShowSetorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSetor ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm text-muted-foreground">Nome</label>
              <Input value={setorNome} onChange={e => setSetorNome(e.target.value)} placeholder="Nome do setor" className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Percentual (%)</label>
              <Input type="number" value={setorPercentual} onChange={e => setSetorPercentual(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <Button onClick={handleSaveSetor} className="w-full">
              <Check className="w-4 h-4 mr-2" /> Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestaoMetas;
