import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, Delete, LockKeyhole, Vote, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Candidato, Eleicao, obterEleicao, obterSessaoCabine, listarCandidatos, computarVoto, playSomUrna } from '@/lib/eleicoes';

type Sessao = { eleitor_id: string; nome: string; funcao: string; habilitado_em: string };

export default function EleicaoUrna() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const cabine = searchParams.get('cabine') || 'Cabine 1';
  const [eleicao, setEleicao] = useState<Eleicao | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [digitos, setDigitos] = useState('');
  const [branco, setBranco] = useState(false);
  const [fim, setFim] = useState(false);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [e, current] = await Promise.all([obterEleicao(id), obterSessaoCabine(id, cabine)]);
      setEleicao(e); setSessao(current as Sessao | null);
      if (e?.status !== 'aberta') setSessao(null);
    } catch { /* polling seguinte recupera falhas transitórias */ }
  }, [id, cabine]);
  useEffect(() => {
    void Promise.all([refresh(), listarCandidatos(id).then(setCandidatos).catch(() => undefined)]);
    const channel = supabase.channel(`urna-eleitor-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'eleicao_eleitores', filter: `eleicao_id=eq.${id}` }, () => void refresh()).subscribe();
    const electionChannel = supabase.channel(`urna-eleicao-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eleicoes', filter: `id=eq.${id}` }, () => void refresh()).subscribe();
    const poll = window.setInterval(() => void refresh(), 2000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); void supabase.removeChannel(electionChannel); if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [id, refresh]);

  const candidato = useMemo(() => !branco && digitos ? candidatos.find((c) => String(c.numero) === String(Number(digitos))) ?? null : null, [branco, candidatos, digitos]);
  const addDigit = (digit: string) => {
    if (fim || sending || branco) return;
    const maxDigits = Math.max(2, ...candidatos.map((c) => String(c.numero).length));
    if (digitos.length >= maxDigits) return;
    playSomUrna.tecla(); setDigitos((prev) => `${prev}${digit}`);
  };
  const corrigir = () => { if (sending || fim) return; playSomUrna.tecla(); setDigitos(''); setBranco(false); };
  const confirmar = async () => {
    if (!sessao || sending || fim) return;
    if (!branco && !candidato) { toast.error('Digite o número de um candidato válido ou selecione BRANCO.'); return; }
    setSending(true);
    try {
      await computarVoto(sessao.eleitor_id, branco ? null : candidato!.id);
      playSomUrna.fim(); setFim(true); setSessao(null); setDigitos(''); setBranco(false);
      timerRef.current = window.setTimeout(() => { setFim(false); void refresh(); }, 3000);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o voto.'); }
    finally { setSending(false); }
  };

  if (!eleicao) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando urna…</div>;
  const waiting = eleicao.status !== 'aberta' || !sessao;
  return <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-3 py-6 text-foreground">
    <div className="w-full max-w-2xl space-y-5">
      {eleicao.imagemUrl && <img src={eleicao.imagemUrl} alt="Banner da eleição" className="mx-auto max-h-32 max-w-full rounded-2xl object-contain" />}
      <header className="text-center"><p className="font-display text-xs uppercase tracking-[.25em] text-cyan">Urna eletrônica · {eleicao.titulo}</p><div className="mx-auto mt-3 h-px max-w-sm bg-gradient-to-r from-transparent via-cyan/60 to-transparent" /></header>
      {fim ? <section className="relative overflow-hidden rounded-3xl border border-green/50 bg-card p-10 text-center shadow-[0_0_45px_hsl(var(--green)/.2)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">{Array.from({ length: 55 }, (_, i) => <span key={i} className="election-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.08}s`, backgroundColor: ['#22d3ee', '#34d399', '#fb923c', '#f472b6', '#facc15'][i % 5] }} />)}</div>
        <Check className="relative mx-auto size-16 text-green" /><h1 className="relative mt-4 font-display text-5xl font-black tracking-widest text-green">FIM</h1><p className="relative mt-2 text-muted-foreground">Seu voto foi registrado. Obrigado!</p>
      </section> : waiting ? <section className="rounded-3xl border border-cyan/30 bg-card p-8 text-center shadow-[0_0_35px_hsl(var(--cyan)/.12)] sm:p-12">
        <div className="mx-auto grid size-20 animate-pulse place-items-center rounded-full border border-cyan/50 bg-cyan/10 text-cyan"><LockKeyhole className="size-9" /></div><h1 className="mt-5 font-display text-xl font-bold">Aguardando liberação</h1><p className="mx-auto mt-2 max-w-md text-muted-foreground">Cabine de votação pronta. Aguarde o mesário liberar sua participação.</p><div className="mt-5 inline-flex items-center gap-2 text-xs text-cyan"><span className="size-2 animate-pulse rounded-full bg-green" />Conectada ao painel do mesário</div>
      </section> : <section className="space-y-4 rounded-3xl border border-cyan/30 bg-card p-4 shadow-[0_0_35px_hsl(var(--cyan)/.1)] sm:p-6">
        <div className="text-center"><h1 className="font-display text-lg font-bold">Olá, {sessao?.nome}!</h1><p className="text-sm text-muted-foreground">{sessao?.funcao ? `${sessao.funcao} · ` : ''}Seu voto é secreto e inviolável.</p></div>
        <div className="rounded-xl border border-cyan/30 bg-background p-4 text-center"><p className="text-xs uppercase tracking-widest text-muted-foreground">Seu voto</p><div className="mt-2 min-h-14 font-display text-4xl font-black tracking-[.35em] text-cyan">{branco ? 'BRANCO' : digitos || '— —'}</div></div>
        {candidato && <div className="flex items-center gap-4 rounded-2xl border border-green/40 bg-green/5 p-4">{candidato.fotoUrl ? <img src={candidato.fotoUrl} alt={candidato.nome} className="size-20 rounded-xl object-cover" /> : <div className="grid size-20 place-items-center rounded-xl bg-secondary font-display text-2xl text-cyan">{candidato.numero}</div>}<div className="min-w-0"><h2 className="truncate font-display text-lg font-bold">{candidato.nome}</h2><p className="text-sm text-muted-foreground">{candidato.cargo}</p><p className="text-xs text-muted-foreground">{candidato.setor}</p></div></div>}
        {!branco && digitos.length > 0 && !candidato && <p className="text-center text-sm text-orange">Número não corresponde a um candidato. Confira e corrija.</p>}
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">{['1','2','3','4','5','6','7','8','9','0'].map((n, i) => <Button key={n} variant="secondary" className={`h-14 font-display text-xl font-bold ${i === 9 ? 'col-start-2' : ''}`} onClick={() => addDigit(n)}>{n}</Button>)}<div className="col-span-3 grid grid-cols-3 gap-2 pt-2"><Button variant="outline" className="border-coral text-coral" disabled={!eleicao.permitirVotoBranco} onClick={() => { playSomUrna.tecla(); setBranco(true); setDigitos(''); }}>BRANCO</Button><Button variant="secondary" onClick={corrigir}><Delete className="mr-1 size-4" />CORRIGE</Button><Button className="bg-green text-black hover:bg-green/80" disabled={sending} onClick={() => void confirmar()}><Check className="mr-1 size-4" />{sending ? '...' : 'CONFIRMA'}</Button></div></div>
        <div><p className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">Ou escolha um candidato</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{candidatos.map((c) => <button key={c.id} onClick={() => { playSomUrna.tecla(); setBranco(false); setDigitos(String(c.numero)); }} className="flex min-w-0 items-center gap-2 rounded-xl border border-border p-2 text-left transition hover:border-cyan hover:bg-cyan/5">{c.fotoUrl ? <img src={c.fotoUrl} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-display font-bold text-cyan">{c.numero}</span>}<span className="min-w-0"><b className="block truncate text-sm">{c.nome}</b><small className="text-muted-foreground">Nº {c.numero}</small></span></button>)}</div></div>
        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground"><Volume2 className="size-3" />Sons da urna ativos</p>
      </section>}
      <p className="text-center text-xs text-muted-foreground"><Vote className="mr-1 inline size-3" />Voto anônimo e protegido</p>
    </div>
  </main>;
}
