import { useState, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DEFAULTS = [0.5, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2];

interface PesoRow { id: string; dia_semana: number; peso: number }

const PesosDiaSemana = () => {
  const [pesos, setPesos] = useState<PesoRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('metas_pesos_semana')
      .select('*')
      .order('dia_semana');
    if (data) setPesos(data.map((r: any) => ({ id: r.id, dia_semana: r.dia_semana, peso: Number(r.peso) })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const getPeso = (dia: number) => pesos.find(p => p.dia_semana === dia)?.peso ?? DEFAULTS[dia];

  const handleChange = async (dia: number, value: string) => {
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;

    setSaving(dia);
    const existing = pesos.find(p => p.dia_semana === dia);
    if (existing) {
      await supabase.from('metas_pesos_semana').update({ peso: num }).eq('id', existing.id);
    } else {
      await supabase.from('metas_pesos_semana').insert({ dia_semana: dia, peso: num });
    }
    await load();
    setSaving(null);
  };

  const handleRestore = async () => {
    for (let i = 0; i < 7; i++) {
      const existing = pesos.find(p => p.dia_semana === i);
      if (existing) {
        await supabase.from('metas_pesos_semana').update({ peso: DEFAULTS[i] }).eq('id', existing.id);
      }
    }
    await load();
    toast.success('Pesos restaurados ao padrão');
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Peso dos Dias da Semana</h3>
        <Button size="sm" variant="outline" onClick={handleRestore}>
          <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
        </Button>
      </div>

      <div className="space-y-2">
        {DIAS.map((nome, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-foreground flex-1">{nome}</span>
            <Input
              type="text"
              inputMode="decimal"
              defaultValue={getPeso(i).toString().replace('.', ',')}
              key={`${i}-${getPeso(i)}`}
              onBlur={e => handleChange(i, e.target.value)}
              className="w-20 text-center h-8 text-sm"
              disabled={saving === i}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Pesos maiores aumentam a meta do dia, pesos menores reduzem.
      </p>
    </div>
  );
};

export default PesosDiaSemana;
