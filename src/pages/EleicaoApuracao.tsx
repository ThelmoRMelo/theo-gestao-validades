import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Printer, RefreshCw, Trophy, Users, Vote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { apurarResultados, Eleicao, Eleitor, encerrarEleicao, listarEleitores, obterEleicao, ResultadoItem } from '@/lib/eleicoes';

export default function EleicaoApuracao() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [eleicao, setEleicao] = useState<Eleicao | null>(null);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [e, r, voters] = await Promise.all([obterEleicao(id), apurarResultados(id), listarEleitores(id)]);
      setEleicao(e); setResultados(r); setEleitores(voters);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a apuração.'); }
  }, [id]);
  useEffect(() => {
    void refresh();
    const channel = supabase.channel(`apuracao-eleicao-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'eleicao_eleitores', filter: `eleicao_id=eq.${id}` }, () => void refresh()).subscribe();
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [id, refresh]);

  const candidates = useMemo(() => resultados.filter((r) => r.candidatoId !== null).sort((a, b) => b.votos - a.votos || (a.numero ?? 0) - (b.numero ?? 0)), [resultados]);
  const voted = eleitores.filter((e) => e.status === 'votou').length;
  const validVotes = candidates.reduce((sum, item) => sum + item.votos, 0);
  const brancoReported = resultados.filter((r) => r.candidatoId === null).reduce((sum, item) => sum + item.votos, 0);
  const blankVotes = Math.max(brancoReported, voted - validVotes, 0);
  const maxVotes = Math.max(1, ...candidates.map((c) => c.votos));

  const finalizar = async () => {
    if (!eleicao || closing) return;
    if (!confirm(`Encerrar oficialmente “${eleicao.titulo}”? A urna será bloqueada e o resultado ficará consolidado.`)) return;
    setClosing(true);
    try { await encerrarEleicao(id); await refresh(); toast.success('Eleição encerrada oficialmente.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar a eleição.'); }
    finally { setClosing(false); }
  };

  if (!eleicao) return <div className="p-8 text-center text-muted-foreground">Carregando apuração…</div>;
  return <main className="min-h-screen px-4 pb-10 text-foreground print:bg-white print:text-black">
    <header className="header-gradient mb-5 flex items-center gap-3 rounded-b-2xl px-4 py-4 print:hidden"><button onClick={() => navigate(`/ferramentas/eleicoes`)} className="grid size-10 place-items-center rounded-xl bg-primary-foreground/20" aria-label="Voltar"><ArrowLeft /></button><div className="min-w-0 flex-1"><h1 className="truncate font-display text-lg font-bold">Apuração ao Vivo</h1><p className="truncate text-sm opacity-80">{eleicao.titulo}</p></div><Button variant="ghost" size="icon" onClick={() => void refresh()} aria-label="Atualizar"><RefreshCw /></Button></header>
    <section className="print-report mx-auto max-w-4xl space-y-5">
      <div className="hidden text-center print:block"><h1 className="text-2xl font-bold">Ata de Apuração — {eleicao.titulo}</h1><p>{new Date().toLocaleString('pt-BR')} · Status: {eleicao.status === 'encerrada' ? 'Encerrada' : 'Em andamento'}</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-cyan/30 bg-card p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" /> Eleitores que votaram</p><p className="mt-1 font-display text-3xl font-bold text-cyan">{voted}</p></article><article className="rounded-2xl border border-green/30 bg-card p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Vote className="size-4" /> Votos válidos</p><p className="mt-1 font-display text-3xl font-bold text-green">{validVotes}</p></article><article className="col-span-2 rounded-2xl border border-orange/30 bg-card p-4 sm:col-span-1"><p className="flex items-center gap-2 text-sm text-muted-foreground"><X className="size-4" /> Votos em branco</p><p className="mt-1 font-display text-3xl font-bold text-orange">{blankVotes}</p></article></div>
      <article className="rounded-2xl border border-cyan/30 bg-card p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-display text-xl font-bold">Resultado parcial</h2><p className="text-sm text-muted-foreground">Atualização automática e anônima dos votos.</p></div><span className="flex items-center gap-2 text-xs text-green"><span className="size-2 animate-pulse rounded-full bg-green" />Ao vivo</span></div>
        {!candidates.length && <p className="py-8 text-center text-muted-foreground">{blankVotes > 0 ? 'Até o momento foram registrados apenas votos em branco.' : 'Ainda não há votos computados.'}</p>}
        <div className="space-y-4">{candidates.map((r, index) => {
          const percentage = validVotes ? Math.round((r.votos / validVotes) * 100) : 0;
          return <div key={r.candidatoId ?? r.numero} className={`rounded-xl border p-3 ${index === 0 && r.votos > 0 ? 'border-yellow/50 bg-yellow/5' : 'border-border'}`}>
            <div className="mb-2 flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-bold ${index === 0 ? 'bg-yellow/15 text-yellow' : 'bg-secondary text-cyan'}`}>{index === 0 && r.votos > 0 ? <Crown className="size-5" /> : r.numero ?? index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.nome}{index === 0 && r.votos > 0 && <Trophy className="ml-2 inline size-4 text-yellow" />}</p><p className="text-xs text-muted-foreground">{r.votos} voto(s) · {percentage}%</p></div><span className="font-display text-xl font-bold">{r.votos}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-green shadow-[0_0_12px_hsl(var(--cyan)/.5)] transition-all duration-700" style={{ width: `${Math.max(r.votos ? 4 : 0, (r.votos / maxVotes) * 100)}%` }} /></div>
          </div>;
        })}</div>
      </article>
      {eleicao.status === 'encerrada' && <div className="rounded-xl border border-green/40 bg-green/5 p-4 text-center font-semibold text-green">Resultado oficial consolidado em {eleicao.encerradaEm ? new Date(eleicao.encerradaEm).toLocaleString('pt-BR') : '—'}.</div>}
      <div className="flex flex-wrap gap-2 print:hidden">{eleicao.status !== 'encerrada' && <Button variant="destructive" className="flex-1" disabled={closing} onClick={() => void finalizar()}>{closing ? 'Encerrando…' : 'Encerrar eleição oficialmente'}</Button>}<Button variant="secondary" className="flex-1" onClick={() => window.print()}><Printer className="mr-2 size-4" />Exportar ata / Imprimir</Button></div>
      {eleicao.status === 'encerrada' && <div className="hidden border-t border-black pt-12 print:grid print:grid-cols-2 print:gap-16"><p className="border-t border-black pt-2 text-center">Assinatura do mesário</p><p className="border-t border-black pt-2 text-center">Assinatura do responsável</p></div>}
      <nav className="flex gap-2 print:hidden"><Link to={`/ferramentas/eleicoes/${id}/mesario`}><Button variant="outline">Painel do mesário</Button></Link><Link to={`/eleicao/${id}`}><Button variant="outline">Vitrine pública</Button></Link></nav>
    </section>
  </main>;
}
