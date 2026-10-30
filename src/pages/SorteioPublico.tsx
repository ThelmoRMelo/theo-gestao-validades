import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Gift, Trophy, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sorteio, NumeroVendido, getSorteio, listVendidos, brl, padNum, buildWhatsAppUrl, STATUS_LABEL, getBannerUrl } from '@/lib/sorteios';

const SorteioPublico = () => {
  const { id = '' } = useParams();
  const [s, setS] = useState<Sorteio | null | undefined>(undefined);
  const [vendidosArr, setVendidosArr] = useState<NumeroVendido[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [resumo, setResumo] = useState(false);
  useEffect(() => {
    const carregar = () => listVendidos(id).then((v) => {
      const nums = v.map((item) => item.numero);
      setVendidosArr(v);
      setSel((p) => p.filter((n) => !nums.includes(n)));
    });
    getSorteio(id).then((r) => setS(r ?? null));
    carregar();
    const ch = supabase
      .channel(`pub-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteio_numeros', filter: `sorteio_id=eq.${id}` }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteios', filter: `id=eq.${id}` }, () => getSorteio(id).then((r) => setS(r ?? null)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);
  const vendidos = useMemo(() => new Set<number>(vendidosArr.map((v) => v.numero)), [vendidosArr]);
  useEffect(() => { if (s && s.status !== 'publicado') setSel([]); }, [s?.status]);

  if (s === undefined) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!s) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">Sorteio não encontrado.</div>;
  }

  const numeros = Array.from({ length: s.numeroFinal - s.numeroInicial + 1 }, (_, i) => s.numeroInicial + i);
  const aberto = s.status === 'publicado';
  const disponiveis = numeros.length - vendidos.size;
  const toggle = (n: number) => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const total = sel.length * s.precoUnitario;
  const ordenados = [...sel].sort((a, b) => a - b);

  return (
    <div className="min-h-screen pb-32">
      <header className="header-gradient mb-4">
        <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2"><Gift className="w-5 h-5" /> {s.nome}</h1>
      </header>

      <div className="px-4 max-w-3xl mx-auto space-y-4">
        {s.imagemUrl && <img src={getBannerUrl(s.id)} alt={`Banner de ${s.nome}`} className="w-full max-h-80 rounded-2xl object-cover shadow-lg" />}
        {!aberto && (
          <div className="glass-card rounded-xl p-3 text-sm text-center text-muted-foreground">Sorteio {STATUS_LABEL[s.status].toLowerCase()} — seleção indisponível.</div>
        )}
        {s.status === 'encerrado' && s.ganhador1Numero !== undefined && (
          <section className="glass-card rounded-2xl p-5 border border-primary/40 shadow-lg shadow-primary/10">
            <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2 mb-3"><Trophy className="w-5 h-5" /> Sorteio Concluído</h2>
            <div className="space-y-2 text-sm text-foreground">
              <p>🥇 <b>1º Prêmio: {s.premio1}</b> → Nº {padNum(s.ganhador1Numero, s.numeroFinal)} — {s.ganhador1Nome}</p>
              {s.ganhador2Numero !== undefined && <p>🥈 <b>2º Prêmio: {s.premio2}</b> → Nº {padNum(s.ganhador2Numero, s.numeroFinal)} — {s.ganhador2Nome}</p>}
              {s.ganhador3Numero !== undefined && <p>🥉 <b>3º Prêmio: {s.premio3}</b> → Nº {padNum(s.ganhador3Numero, s.numeroFinal)} — {s.ganhador3Nome}</p>}
            </div>
            {s.sorteadoEm && <p className="text-xs text-muted-foreground mt-3">Apurado em {new Date(s.sorteadoEm).toLocaleString('pt-BR')}</p>}
          </section>
        )}
        {s.descricao && <p className="text-sm text-muted-foreground whitespace-pre-line">{s.descricao}</p>}

        <div className="glass-card rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Prêmios</h2>
          {[s.premio1, s.premio2, s.premio3].map((p, i) => p && <p key={i} className="text-sm text-foreground"><b>{i + 1}º:</b> {p}</p>)}
        </div>

        {s.regras && (
          <div className="glass-card rounded-xl p-4">
            <h2 className="font-semibold text-foreground mb-1">Regras</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{s.regras}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Preço por número</p><p className="font-bold text-primary">{brl(s.precoUnitario)}</p></div>
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Disponíveis</p><p className="font-bold text-primary">{disponiveis} / {numeros.length}</p></div>
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-border" /> Disponível</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" /> Selecionado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted" /> Vendido</span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {numeros.map((n) => {
            const vendido = vendidos.has(n);
            const ativo = sel.includes(n);
            return (
              <button
                key={n}
                disabled={vendido || !aberto}
                onClick={() => toggle(n)}
                aria-pressed={ativo}
                className={`h-10 rounded-lg text-sm font-mono transition-colors border ${
                  vendido ? 'bg-muted text-muted-foreground line-through border-transparent cursor-not-allowed'
                  : ativo ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-foreground hover:border-primary disabled:opacity-50'
                }`}
              >
                {padNum(n, s.numeroFinal)}
              </button>
            );
          })}
        </div>
      </div>

      {aberto && sel.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 glass-card border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{sel.length} número(s)</p>
              <p className="font-bold text-primary">{brl(total)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSel([])}>Limpar</Button>
              <Button onClick={() => setResumo(true)}>Adquirir</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={resumo} onOpenChange={setResumo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resumo do pedido</DialogTitle>
            <DialogDescription>A seleção não é pagamento nem reserva garantida. A aquisição só é confirmada pelo vendedor após o pagamento.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {ordenados.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm font-mono">
                {padNum(n, s.numeroFinal)}
                <button onClick={() => toggle(n)} aria-label={`Remover ${n}`}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="text-sm space-y-1">
            <p>Quantidade: <b>{sel.length}</b></p>
            <p>Preço unitário: <b>{brl(s.precoUnitario)}</b></p>
            <p>Total: <b className="text-primary">{brl(total)}</b></p>
          </div>
          <Button
            disabled={sel.length === 0}
            onClick={() => { window.open(buildWhatsAppUrl(s, sel), '_blank', 'noopener'); setResumo(false); }}
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Confirmar e continuar no WhatsApp
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SorteioPublico;
