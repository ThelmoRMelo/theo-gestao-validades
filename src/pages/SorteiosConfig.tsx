import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Plus, ExternalLink, Copy, Trash2, ClipboardCheck, Trophy, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Sorteio, SorteioStatus, STATUS_LABEL, sorteioSchema, MAX_PREMIOS, listSorteios, saveSorteio, deleteSorteio, onlyDigits, brl, getShareUrl, getBannerUrl, uploadBannerSorteio } from '@/lib/sorteios';

const vazio = (): Sorteio => ({
  id: crypto.randomUUID(), nome: '', descricao: '', numeroInicial: 1, numeroFinal: 100, precoUnitario: 10,
  whatsapp: '', premios: ['', '', ''], premioUnico: false, ganhadores: [], regras: '', status: 'preparacao',
});

const SorteiosConfig = () => {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Sorteio[]>([]);
  const recarregar = () => listSorteios().then(setLista).catch(() => toast.error('Erro ao carregar sorteios'));
  useEffect(() => { recarregar(); }, []);
  const [form, setForm] = useState<Sorteio | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [uploadando, setUploadando] = useState(false);

  const set = <K extends keyof Sorteio>(k: K, v: Sorteio[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const salvar = async () => {
    if (!form) return;
    const r = sorteioSchema.safeParse(form);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErros(e);
      toast.error('Verifique os campos destacados');
      return;
    }
    try { await saveSorteio(r.data); } catch { toast.error('Erro ao salvar'); return; }
    recarregar();
    setForm(null);
    setErros({});
    toast.success('Sorteio salvo');
  };

  const compartilhar = (s: Sorteio) => `https://wa.me/?text=${encodeURIComponent(`${s.nome} — ${getShareUrl(s.id, s.imagemUrl)}`)}`;

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
                  <Button size="sm" onClick={() => navigate(`/ferramentas/sorteios/${s.id}/vendas`)}><ClipboardCheck className="w-3 h-3 mr-1" /> Dar baixa</Button>
                  <Button size="sm" onClick={() => navigate(`/ferramentas/sorteios/${s.id}/apuracao`)}><Trophy className="w-3 h-3 mr-1" /> Apuração</Button>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/sorteio/${s.id}`)}><ExternalLink className="w-3 h-3 mr-1" /> Ver página</Button>
                  <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(getShareUrl(s.id, s.imagemUrl)); toast.success('Link copiado'); }}><Copy className="w-3 h-3 mr-1" /> Copiar link</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.open(compartilhar(s), '_blank', 'noopener')}><MessageCircle className="w-3 h-3 mr-1" /> WhatsApp</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm('Excluir este sorteio e todas as vendas registradas?')) { deleteSorteio(s.id).then(recarregar); } }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </>
        )}

        {form && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div><Label>Nome do sorteio *</Label><Input value={form.nome} onChange={(e) => set('nome', e.target.value)} maxLength={100} /><Err k="nome" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} maxLength={1000} /></div>
            <div className="space-y-2">
              <Label htmlFor="banner-sorteio">Banner do sorteio</Label>
              <Input id="banner-sorteio" type="file" accept="image/*" disabled={uploadando} onChange={async (e) => {
                const input = e.currentTarget; const file = input.files?.[0]; if (!file || !form) return;
                setUploadando(true);
                try { const path = await uploadBannerSorteio(form.id, file); set('imagemUrl', path); toast.success('Banner enviado'); }
                catch { toast.error('Erro ao enviar banner'); }
                finally { setUploadando(false); input.value = ''; }
              }} />
              {form.imagemUrl && <img src={getBannerUrl(form.id, form.imagemUrl)} alt="Prévia do banner" className="w-full max-h-48 rounded-lg object-cover" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número inicial *</Label><Input type="number" value={form.numeroInicial} onChange={(e) => set('numeroInicial', parseInt(e.target.value || '0'))} /><Err k="numeroInicial" /></div>
              <div><Label>Número final *</Label><Input type="number" value={form.numeroFinal} onChange={(e) => set('numeroFinal', parseInt(e.target.value || '0'))} /><Err k="numeroFinal" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Quantidade de números: {Math.max(0, form.numeroFinal - form.numeroInicial + 1)}</p>
            <div><Label>Preço por número (R$) *</Label><Input type="number" step="0.01" min="0" value={form.precoUnitario} onChange={(e) => set('precoUnitario', parseFloat(e.target.value || '0'))} /><Err k="precoUnitario" /></div>
            <div><Label>WhatsApp do responsável * (país + DDD + número)</Label><Input inputMode="numeric" placeholder="5585999999999" value={form.whatsapp} onChange={(e) => set('whatsapp', onlyDigits(e.target.value))} maxLength={13} /><Err k="whatsapp" /></div>
            <div>
              <Label>Quantidade de prêmios (1 a {MAX_PREMIOS})</Label>
              <Input type="number" min={1} max={MAX_PREMIOS} value={form.premios.length} onChange={(e) => {
                const n = Math.min(MAX_PREMIOS, Math.max(1, parseInt(e.target.value || '1')));
                set('premios', Array.from({ length: n }, (_, i) => form.premios[i] ?? ''));
              }} className="w-28" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {form.premios.map((p, i) => (
                <div key={i}><Label>{i + 1}º prêmio *</Label><Input value={p} maxLength={200} onChange={(e) => set('premios', form.premios.map((x, j) => (j === i ? e.target.value : x)))} /></div>
              ))}
            </div>
            <Err k="premios" />
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div><Label htmlFor="premio-unico">Prêmio único por participante</Label><p className="text-xs text-muted-foreground">Impede que a mesma pessoa ganhe mais de um prêmio neste sorteio.</p></div>
              <Switch id="premio-unico" checked={form.premioUnico} onCheckedChange={(v) => set('premioUnico', v)} />
            </div>
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
              <Button className="flex-1" disabled={uploadando} onClick={salvar}>{uploadando ? 'Enviando banner…' : 'Salvar'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SorteiosConfig;
