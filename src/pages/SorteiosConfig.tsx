import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Plus, ExternalLink, Copy, Trash2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Sorteio, SorteioStatus, STATUS_LABEL, sorteioSchema, listSorteios, saveSorteio, deleteSorteio, onlyDigits, brl } from '@/lib/sorteios';

const vazio = (): Sorteio => ({
  id: crypto.randomUUID(), nome: '', descricao: '', numeroInicial: 1, numeroFinal: 100, precoUnitario: 10,
  whatsapp: '', premio1: '', premio2: '', premio3: '', regras: '', status: 'preparacao',
});

const SorteiosConfig = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Sorteio[]>(listSorteios());
  const [form, setForm] = useState<Sorteio | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const set = <K extends keyof Sorteio>(k: K, v: Sorteio[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const salvar = () => {
    if (!form) return;
    const r = sorteioSchema.safeParse(form);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErros(e);
      toast.error('Verifique os campos destacados');
      return;
    }
    saveSorteio(r.data);
    setLista(listSorteios());
    setForm(null);
    setErros({});
    toast.success('Sorteio salvo (rascunho neste aparelho)');
  };

  const linkPublico = (id: string) => `${window.location.origin}/sorteio/${id}`;

  const Err = ({ k }: { k: string }) => (erros[k] ? <p className="text-xs text-destructive mt-1">{erros[k]}</p> : null);

  return (
    <div className="min-h-screen pb-8">
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button onClick={() => (form ? setForm(null) : navigate('/ferramentas'))} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
          <Gift className="w-5 h-5" /> Sorteios & Prêmios
        </h1>
      </header>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        <div className="glass-card rounded-xl p-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 text-primary" />
          Etapa 1 (prévia): os sorteios ficam salvos apenas neste aparelho. O link público funcionará para outras pessoas após a Etapa 2.
        </div>

        {!form && (
          <>
            <Button onClick={() => { setForm(vazio()); setErros({}); }} className="w-full"><Plus className="w-4 h-4 mr-2" /> Novo sorteio</Button>
            {lista.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum sorteio configurado.</p>}
            {lista.map((s) => (
              <div key={s.id} className="glass-card rounded-xl p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{s.nome}</h3>
                    <p className="text-xs text-muted-foreground">{s.numeroFinal - s.numeroInicial + 1} números · {brl(s.precoUnitario)} cada</p>
                  </div>
                  <span className="text-xs px-2 py-1 h-fit rounded-full border border-primary text-primary">{STATUS_LABEL[s.status]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setForm(s); setErros({}); }}>Editar</Button>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/sorteio/${s.id}`)}><ExternalLink className="w-3 h-3 mr-1" /> Ver página</Button>
                  <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(linkPublico(s.id)); toast.success('Link copiado'); }}><Copy className="w-3 h-3 mr-1" /> Copiar link</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm('Excluir este rascunho?')) { deleteSorteio(s.id); setLista(listSorteios()); } }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </>
        )}

        {form && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div><Label>Nome do sorteio *</Label><Input value={form.nome} onChange={(e) => set('nome', e.target.value)} maxLength={100} /><Err k="nome" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} maxLength={1000} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número inicial *</Label><Input type="number" value={form.numeroInicial} onChange={(e) => set('numeroInicial', parseInt(e.target.value || '0'))} /><Err k="numeroInicial" /></div>
              <div><Label>Número final *</Label><Input type="number" value={form.numeroFinal} onChange={(e) => set('numeroFinal', parseInt(e.target.value || '0'))} /><Err k="numeroFinal" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Quantidade de números: {Math.max(0, form.numeroFinal - form.numeroInicial + 1)}</p>
            <div><Label>Preço por número (R$) *</Label><Input type="number" step="0.01" min="0" value={form.precoUnitario} onChange={(e) => set('precoUnitario', parseFloat(e.target.value || '0'))} /><Err k="precoUnitario" /></div>
            <div><Label>WhatsApp do responsável * (país + DDD + número)</Label><Input inputMode="numeric" placeholder="5585999999999" value={form.whatsapp} onChange={(e) => set('whatsapp', onlyDigits(e.target.value))} maxLength={13} /><Err k="whatsapp" /></div>
            <div><Label>1º prêmio *</Label><Input value={form.premio1} onChange={(e) => set('premio1', e.target.value)} /><Err k="premio1" /></div>
            <div><Label>2º prêmio</Label><Input value={form.premio2} onChange={(e) => set('premio2', e.target.value)} /></div>
            <div><Label>3º prêmio</Label><Input value={form.premio3} onChange={(e) => set('premio3', e.target.value)} /></div>
            <div><Label>Regras de participação</Label><Textarea value={form.regras} onChange={(e) => set('regras', e.target.value)} maxLength={2000} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as SorteioStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setForm(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={salvar}>Salvar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SorteiosConfig;
