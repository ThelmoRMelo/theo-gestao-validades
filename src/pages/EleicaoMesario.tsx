import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search, UserCheck, UserPlus, Vote, XCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cancelarHabilitacao, Eleicao, Eleitor, habilitarEleitor, listarEleitores, obterEleicao, salvarEleitor } from '@/lib/eleicoes';

export default function EleicaoMesario() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [eleicao, setEleicao] = useState<Eleicao | null>(null);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cabine, setCabine] = useState('Cabine 1');
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const [preCadastro, setPreCadastro] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [e, people] = await Promise.all([obterEleicao(id), listarEleitores(id)]);
      setEleicao(e); setEleitores(people);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a lista.'); }
  }, [id]);
  useEffect(() => {
    void refresh();
    const channel = supabase.channel(`eleitores-mesario-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'eleicao_eleitores', filter: `eleicao_id=eq.${id}` }, () => void refresh()).subscribe();
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [id, refresh]);

  const aptos = useMemo(() => eleitores.filter((e) => e.status === 'apto'), [eleitores]);
  const query = busca.trim().toLocaleLowerCase('pt-BR');
  const filtered = eleitores.filter((e) => !query || `${e.nome} ${e.funcao} ${e.matricula}`.toLocaleLowerCase('pt-BR').includes(query));
  const habilitados = filtered.filter((e) => e.status === 'habilitado');
  const votaram = filtered.filter((e) => e.status === 'votou');

  const liberar = async (event: FormEvent) => {
    event.preventDefault();
    if (!eleicao || eleicao.status !== 'aberta') { toast.error('A votação não está aberta.'); return; }
    if (!nome.trim()) { toast.error('Informe o nome do colaborador.'); return; }
    setSaving(true);
    try {
      if (preCadastro) await salvarEleitor(id, { nome: nome.trim(), funcao, matricula });
      else await habilitarEleitor({ eleicaoId: id, nome: nome.trim(), funcao, matricula, cabine });
      toast.success(preCadastro ? 'Eleitor pré-cadastrado como apto.' : `${nome.trim()} liberado(a) para ${cabine}.`);
      setNome(''); setFuncao(''); setMatricula(''); await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível liberar o eleitor.');
    } finally { setSaving(false); }
  };

  const liberarApto = async (e: Eleitor) => {
    setNome(e.nome); setFuncao(e.funcao); setMatricula(e.matricula); setPreCadastro(false);
    setSaving(true);
    try { await habilitarEleitor({ eleicaoId: id, nome: e.nome, funcao: e.funcao, matricula: e.matricula, cabine }); toast.success(`${e.nome} liberado(a) para votação.`); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível liberar.'); }
    finally { setSaving(false); setNome(''); setFuncao(''); setMatricula(''); }
  };

  if (!eleicao) return <div className="p-8 text-center text-muted-foreground">Carregando eleição…</div>;
  return <main className="min-h-screen px-4 pb-10 text-foreground">
    <header className="header-gradient mb-5 flex items-center gap-3 rounded-b-2xl px-4 py-4"><button onClick={() => navigate(`/ferramentas/eleicoes`)} className="grid size-10 place-items-center rounded-xl bg-primary-foreground/20" aria-label="Voltar"><ArrowLeft /></button><div className="min-w-0 flex-1"><h1 className="truncate font-display text-lg font-bold">Painel do Mesário</h1><p className="truncate text-sm opacity-80">{eleicao.titulo} · <span className={eleicao.status === 'aberta' ? 'text-green' : 'text-orange'}>{eleicao.status === 'aberta' ? 'Votação aberta' : eleicao.status === 'encerrada' ? 'Encerrada' : 'Em preparação'}</span></p></div><Button size="icon" variant="ghost" onClick={() => void refresh()} aria-label="Atualizar"><RefreshCw /></Button></header>
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-4 rounded-2xl border border-cyan/30 bg-card p-4 sm:p-5">
        <div><h2 className="font-display text-lg font-bold text-cyan">Liberar eleitor para votação</h2><p className="text-sm text-muted-foreground">A urna será habilitada apenas após a liberação do mesário.</p></div>
        <form onSubmit={liberar} className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><Label htmlFor="pre-cadastro">Pré-cadastrar como apto</Label><p className="text-xs text-muted-foreground">Registra presença sem liberar a urna.</p></div><input id="pre-cadastro" type="checkbox" checked={preCadastro} onChange={(e) => setPreCadastro(e.target.checked)} className="size-5 accent-cyan" /></div>
          <div><Label htmlFor="eleitor-nome">Nome do colaborador *</Label><Input id="eleitor-nome" list="eleitores-aptos" required value={nome} onChange={(e) => { setNome(e.target.value); const selected = aptos.find((a) => a.nome.toLocaleLowerCase('pt-BR') === e.target.value.toLocaleLowerCase('pt-BR')); if (selected) { setFuncao(selected.funcao); setMatricula(selected.matricula); setPreCadastro(false); } }} autoComplete="off" placeholder="Digite ou selecione um eleitor apto" /><datalist id="eleitores-aptos">{aptos.map((a) => <option key={a.id} value={a.nome}>{a.funcao}</option>)}</datalist></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Função / Cargo</Label><Input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Ex.: Repositor" /></div><div><Label>Matrícula</Label><Input value={matricula} onChange={(e) => setMatricula(e.target.value)} /></div></div>
          {!preCadastro && <div><Label>Cabine / Urna</Label><Input value={cabine} onChange={(e) => setCabine(e.target.value)} placeholder="Cabine 1" /></div>}
          <Button type="submit" className="w-full" disabled={saving || eleicao.status !== 'aberta'}><UserCheck className="mr-2 size-4" />{saving ? 'Processando…' : preCadastro ? 'Cadastrar eleitor apto' : 'Liberar voto na urna'}</Button>
          {eleicao.status !== 'aberta' && <p className="text-center text-sm text-orange">Abra a votação na configuração para liberar eleitores.</p>}
        </form>
        {aptos.length > 0 && <div className="border-t pt-3"><h3 className="mb-2 text-sm font-semibold">Eleitores aptos ({aptos.length})</h3><div className="max-h-52 space-y-2 overflow-y-auto">{aptos.map((e) => <div key={e.id} className="flex items-center gap-2 rounded-lg border p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.nome}</p><p className="text-xs text-muted-foreground">{e.funcao || 'Função não informada'} {e.matricula && `· ${e.matricula}`}</p></div><Button size="sm" onClick={() => void liberarApto(e)} disabled={saving || eleicao.status !== 'aberta'}><UserPlus className="mr-1 size-4" />Liberar</Button></div>)}</div></div>}
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Acompanhamento ao vivo</h2><Button variant="ghost" size="icon" onClick={() => void refresh()} aria-label="Atualizar lista"><RefreshCw className="size-4" /></Button></div>
        <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-orange/30 p-3"><p className="text-xs text-muted-foreground">Aguardando na urna</p><p className="font-display text-2xl font-bold text-orange">{eleitores.filter((e) => e.status === 'habilitado').length}</p></div><div className="rounded-xl border border-green/30 p-3"><p className="text-xs text-muted-foreground">Votaram</p><p className="font-display text-2xl font-bold text-green">{eleitores.filter((e) => e.status === 'votou').length}</p></div></div>
        <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, função ou matrícula" /></div>
        <div><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange"><Vote className="size-4" /> Liberados aguardando</h3>{habilitados.length ? habilitados.map((e) => <div key={e.id} className="mb-2 flex items-center gap-2 rounded-xl border border-orange/20 p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{e.nome}</p><p className="text-xs text-muted-foreground">{e.cabine || 'Cabine principal'} · liberado {e.habilitadoEm ? new Date(e.habilitadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'agora'}</p></div><Button variant="destructive" size="sm" onClick={() => void cancelarHabilitacao(e.id).then(refresh).then(() => toast.success('Liberação cancelada.')).catch((err) => toast.error(err.message))}><XCircle className="mr-1 size-4" />Cancelar</Button></div>) : <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum eleitor aguardando.</p>}</div>
        <div><h3 className="mb-2 text-sm font-semibold text-green">Lista de presença ({votaram.length})</h3><div className="max-h-64 space-y-2 overflow-y-auto">{votaram.map((e) => <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border p-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{e.nome}</p><p className="text-xs text-muted-foreground">{e.funcao || 'Função não informada'}</p></div><time className="shrink-0 text-xs text-muted-foreground">{e.votouEm ? new Date(e.votouEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Votou'}</time></div>)}</div></div>
      </section>
    </div>
    <nav className="mx-auto mt-5 flex max-w-5xl flex-wrap gap-2"><Link to={`/ferramentas/eleicoes/${id}/urna?cabine=${encodeURIComponent(cabine || 'Cabine 1')}`}><Button variant="secondary"><Vote className="mr-2 size-4" />Abrir urna ({cabine || 'Cabine 1'})</Button></Link><Link to={`/ferramentas/eleicoes/${id}/apuracao`}><Button variant="secondary"><BarChart3 className="mr-2 size-4" />Apuração</Button></Link></nav>
  </main>;
}

