import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Share2, Trophy, Users, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apurarResultados, Candidato, Eleicao, listarCandidatos, obterEleicao, ResultadoItem, STATUS_LABEL, TIPO_LABEL } from '@/lib/eleicoes';

export default function EleicaoPublica() {
  const { id = '' } = useParams();
  const [eleicao, setEleicao] = useState<Eleicao | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([obterEleicao(id), listarCandidatos(id)]).then(async ([e, people]) => {
      if (!active) return;
      setEleicao(e); setCandidatos(people);
      if (e?.status === 'encerrada') setResultados(await apurarResultados(id));
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'Não foi possível carregar esta eleição.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const sortedResults = useMemo(() => [...resultados].filter((r) => r.candidatoId).sort((a, b) => b.votos - a.votos), [resultados]);
  const share = async () => {
    const message = `Conheça os candidatos de ${eleicao?.titulo}: ${location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <main className="grid min-h-screen place-items-center text-muted-foreground">Carregando vitrine…</main>;
  if (!eleicao) return <main className="grid min-h-screen place-items-center px-4 text-center"><div><h1 className="font-display text-2xl font-bold">Eleição não encontrada</h1><p className="mt-2 text-muted-foreground">O link pode estar incorreto ou a eleição não está publicada.</p></div></main>;
  return <main className="min-h-screen px-4 pb-12 text-foreground">
    {eleicao.imagemUrl && <div className="mx-auto max-w-5xl pt-4"><img src={eleicao.imagemUrl} alt={`Banner de ${eleicao.titulo}`} className="max-h-[360px] w-full rounded-3xl border border-cyan/20 object-cover shadow-[0_0_35px_hsl(var(--cyan)/.12)]" /></div>}
    <section className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="rounded-3xl border border-cyan/30 bg-card p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan">{TIPO_LABEL[eleicao.tipo]}</p><h1 className="mt-2 break-words font-display text-2xl font-black sm:text-4xl">{eleicao.titulo}</h1><p className="mt-3 text-sm text-muted-foreground">{eleicao.descricao}</p></div><span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${eleicao.status === 'aberta' ? 'border-green text-green' : eleicao.status === 'encerrada' ? 'border-muted-foreground text-muted-foreground' : 'border-orange text-orange'}`}>{STATUS_LABEL[eleicao.status]}</span></div>
        {eleicao.regras && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-background/60 p-4 text-sm"><h2 className="mb-2 font-semibold text-cyan">Regras e informações</h2>{eleicao.regras}</div>}
        <Button className="mt-5" onClick={() => void share()}><Share2 className="mr-2 size-4" />Compartilhar no WhatsApp</Button>
      </header>
      <div className="flex items-center gap-2"><Users className="size-5 text-cyan" /><h2 className="font-display text-xl font-bold">Candidatos oficiais</h2></div>
      {!candidatos.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Os candidatos ainda não foram publicados.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{candidatos.map((c) => <article key={c.id} className="overflow-hidden rounded-2xl border border-cyan/20 bg-card shadow-[0_0_18px_hsl(var(--cyan)/.06)]">
        {c.fotoUrl ? <img src={c.fotoUrl} alt={c.nome} className="h-52 w-full object-cover" /> : <div className="grid h-40 place-items-center bg-secondary"><span className="font-display text-6xl font-black text-cyan">{c.numero}</span></div>}
        <div className="p-4"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-cyan/30 bg-cyan/10 font-display text-xl font-bold text-cyan">{c.numero}</span><div className="min-w-0"><h3 className="truncate font-display text-lg font-bold">{c.nome}</h3><p className="text-sm text-muted-foreground">{[c.cargo, c.setor].filter(Boolean).join(' · ')}</p></div></div>{c.descricao && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{c.descricao}</p>}</div>
      </article>)}</div>
      {eleicao.status === 'encerrada' && <section className="space-y-4 rounded-2xl border border-green/30 bg-card p-5"><h2 className="flex items-center gap-2 font-display text-xl font-bold text-green"><Trophy className="size-5" />Resultado oficial</h2>{sortedResults.length ? sortedResults.map((r, i) => <div key={r.candidatoId} className="flex items-center gap-3 rounded-xl border p-3"><span className="grid size-9 place-items-center rounded-full bg-secondary font-display font-bold">{i === 0 ? <Trophy className="size-4 text-yellow" /> : i + 1}</span><span className="min-w-0 flex-1"><b>{r.nome}</b><small className="ml-2 text-muted-foreground">Nº {r.numero}</small></span><span className="font-display font-bold text-cyan">{r.votos} voto(s)</span></div>) : <p className="text-sm text-muted-foreground">Nenhum voto válido foi registrado.</p>}<p className="text-xs text-muted-foreground"><Vote className="mr-1 inline size-3" />Apuração anônima · Eleição encerrada {eleicao.encerradaEm ? new Date(eleicao.encerradaEm).toLocaleDateString('pt-BR') : ''}</p></section>}
    </section>
  </main>;
}
