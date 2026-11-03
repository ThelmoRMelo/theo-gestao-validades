import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Users, Vote, BarChart3, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Candidato, Eleicao, EleicaoStatus, EleicaoTipo, STATUS_LABEL, TIPO_LABEL, eleicaoSchema, excluirCandidato, excluirEleicao, listarCandidatos, listarEleicoes, obterEleicao, salvarCandidato, salvarEleicao, uploadImagemEleicao } from '@/lib/eleicoes';

const vazio = (): Partial<Eleicao> & { titulo: string } => ({ titulo: '', descricao: '', tipo: 'geral', regras: '', status: 'preparacao', permitirEleitorAvulso: true, permitirVotoBranco: true });

export default function EleicoesConfig() {
  const navigate = useNavigate();
  const [eleicoes, setEleicoes] = useState<Eleicao[]>([]);
  const [form, setForm] = useState<(Partial<Eleicao> & { titulo: string }) | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [candidate, setCandidate] = useState<Partial<Candidato> & { nome: string; numero: number }>({ nome: '', numero: 1, cargo: '', setor: '', descricao: '', ordem: 0 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => { try { setEleicoes(await listarEleicoes()); } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao carregar eleições.'); } };
  useEffect(() => { void refresh(); }, []);
  const set = <K extends keyof Eleicao>(key: K, value: Eleicao[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  const abrirEdicao = async (eleicao: Eleicao) => { setForm({ ...eleicao }); setCandidate({ nome: '', numero: 1, cargo: '', setor: '', descricao: '', ordem: 0 }); try { setCandidatos(await listarCandidatos(eleicao.id)); } catch { toast.error('Falha ao carregar candidatos.'); } };

  const salvar = async () => {
    if (!form) return;
    const valid = eleicaoSchema.safeParse(form);
    if (!valid.success) { toast.error(valid.error.issues[0]?.message ?? 'Revise os campos.'); return; }
    if (valid.data.status === 'aberta' && candidatos.length === 0) { toast.error('Cadastre ao menos um candidato antes de abrir a votação.'); return; }
    setSaving(true);
    try {
      const id = await salvarEleicao({ ...valid.data, id: form.id } as Partial<Eleicao> & { titulo: string });
      const saved = await obterEleicao(id);
      await refresh(); setForm(saved ?? { ...valid.data, id });
      toast.success('Eleição salva.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  const enviarImagem = async (file: File, target: 'banner' | 'foto') => {
    setUploading(true);
    try {
      const url = await uploadImagemEleicao(file, target === 'banner' ? 'banners' : 'candidatos');
      if (target === 'banner') set('imagemUrl', url);
      else setCandidate((current) => ({ ...current, fotoUrl: url }));
      toast.success('Imagem otimizada e enviada.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha no upload da imagem.'); }
    finally { setUploading(false); }
  };

  const salvarCandidatoForm = async () => {
    if (!form?.id) { toast.error('Salve a eleição antes de incluir candidatos.'); return; }
    if (!candidate.nome.trim() || !Number.isInteger(Number(candidate.numero)) || Number(candidate.numero) < 0) { toast.error('Informe nome e número de votação válido.'); return; }
    try {
      await salvarCandidato({ ...candidate, eleicaoId: form.id, nome: candidate.nome.trim(), numero: Number(candidate.numero) });
      setCandidatos(await listarCandidatos(form.id));
      setCandidate({ nome: '', numero: 1, cargo: '', setor: '', descricao: '', ordem: 0 });
      toast.success('Candidato salvo.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar candidato.'); }
  };

  return <main className="min-h-screen px-4 pb-10 text-foreground">
    <header className="header-gradient mb-6 flex items-center gap-4 rounded-b-2xl px-4 py-5">
      <button onClick={() => form ? setForm(null) : navigate('/ferramentas')} className="grid size-10 place-items-center rounded-xl bg-primary-foreground/20" aria-label="Voltar"><ArrowLeft className="size-5" /></button>
      <div><h1 className="font-display text-xl font-bold">Eleições & Votações</h1><p className="text-sm opacity-80">Configure eleições, candidatos e acompanhe a votação.</p></div>
    </header>

    <section className="mx-auto max-w-4xl space-y-4">
      {!form ? <>
        <Button className="w-full" onClick={() => { setForm(vazio()); setCandidatos([]); }}><Plus className="mr-2 size-4" /> Nova eleição</Button>
        {!eleicoes.length && <p className="py-12 text-center text-muted-foreground">Nenhuma eleição cadastrada.</p>}
        {eleicoes.map((e) => <article key={e.id} className="rounded-2xl border border-cyan/30 bg-card p-4 shadow-[0_0_20px_hsl(var(--cyan)/.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">{e.imagemUrl && <img src={e.imagemUrl} alt="" className="size-16 rounded-xl object-cover" />}<div><h2 className="font-display text-lg font-bold">{e.titulo}</h2><p className="text-sm text-muted-foreground">{TIPO_LABEL[e.tipo]}</p></div></div>
            <span className={`rounded-full border px-3 py-1 text-xs ${e.status === 'aberta' ? 'border-green text-green' : e.status === 'encerrada' ? 'border-muted-foreground text-muted-foreground' : 'border-orange text-orange'}`}>{STATUS_LABEL[e.status]}</span>
          </div>
          {e.descricao && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{e.descricao}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void abrirEdicao(e)}>Editar / Candidatos</Button>
            <Button size="sm" onClick={() => navigate(`/ferramentas/eleicoes/${e.id}/mesario`)}><Users className="mr-1 size-4" /> Mesário</Button>
            <Button size="sm" onClick={() => navigate(`/ferramentas/eleicoes/${e.id}/urna`)}><Vote className="mr-1 size-4" /> Urna</Button>
            <Button size="sm" onClick={() => navigate(`/ferramentas/eleicoes/${e.id}/apuracao`)}><BarChart3 className="mr-1 size-4" /> Apuração</Button>
            <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(`${location.origin}/eleicao/${e.id}`); toast.success('Link público copiado.'); }}><Copy className="mr-1 size-4" /> Link público</Button>
            <Button size="sm" variant="secondary" onClick={() => window.open(`/eleicao/${e.id}`, '_blank', 'noopener')}><ExternalLink className="mr-1 size-4" /> Vitrine</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Excluir a eleição “${e.titulo}” e seus dados?`)) void excluirEleicao(e.id).then(refresh).then(() => toast.success('Eleição excluída.')).catch((err) => toast.error(err.message)); }}><Trash2 className="size-4" /></Button>
          </div>
        </article>)}
      </> : <div className="space-y-5 rounded-2xl border border-cyan/30 bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold">{form.id ? 'Editar eleição' : 'Nova eleição'}</h2><span className="text-xs text-muted-foreground">{form.id ? 'Salve alterações antes de sair' : 'Configure os dados iniciais'}</span></div>
        <div><Label>Título *</Label><Input value={form.titulo} maxLength={120} onChange={(e) => set('titulo', e.target.value)} placeholder="Eleição CIPA 2026/2027" /></div>
        <div><Label>Tipo</Label><Select value={form.tipo ?? 'geral'} onValueChange={(v) => set('tipo', v as EleicaoTipo)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPO_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Descrição</Label><Textarea value={form.descricao ?? ''} maxLength={2000} onChange={(e) => set('descricao', e.target.value)} /></div>
        <div><Label>Regras / Informações adicionais</Label><Textarea value={form.regras ?? ''} maxLength={4000} onChange={(e) => set('regras', e.target.value)} /></div>
        <div className="space-y-2"><Label>Banner da eleição (JPEG otimizado até 1200 px / 300 KB)</Label><Input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void enviarImagem(file, 'banner'); e.currentTarget.value = ''; }} />{form.imagemUrl && <img src={form.imagemUrl} alt="Prévia do banner" className="max-h-56 w-full rounded-xl object-cover" />}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><Label>Permitir eleitor avulso</Label><p className="text-xs text-muted-foreground">Cadastro no momento da votação</p></div><Switch checked={form.permitirEleitorAvulso ?? true} onCheckedChange={(v) => set('permitirEleitorAvulso', v)} /></div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><Label>Permitir voto em branco</Label></div><Switch checked={form.permitirVotoBranco ?? true} onCheckedChange={(v) => set('permitirVotoBranco', v)} /></div>
        </div>
        <div><Label>Status</Label><Select disabled={form.status === 'encerrada'} value={form.status ?? 'preparacao'} onValueChange={(v) => set('status', v as EleicaoStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v} disabled={v === 'encerrada' && form.status !== 'encerrada'}>{l}{v === 'encerrada' && form.status !== 'encerrada' ? ' (encerre pela apuração)' : ''}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">O encerramento oficial só pode ser feito na tela de apuração.</p></div>
        <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setForm(null)}>Voltar</Button><Button className="flex-1" disabled={saving || uploading} onClick={() => void salvar()}>{saving ? 'Salvando…' : 'Salvar eleição'}</Button></div>

        {form.id && <section className="space-y-4 border-t border-border pt-5">
          <h3 className="font-display text-lg font-bold"><ClipboardList className="mr-2 inline size-5 text-cyan" />Candidatos oficiais</h3>
          <div className="grid gap-2 sm:grid-cols-2">{candidatos.map((c) => <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
            {c.fotoUrl ? <img src={c.fotoUrl} alt={c.nome} className="size-14 rounded-full object-cover" /> : <div className="grid size-14 place-items-center rounded-full bg-secondary font-display text-xl text-cyan">{c.numero}</div>}
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.nome}</p><p className="text-xs text-muted-foreground">Nº {c.numero} · {[c.cargo, c.setor].filter(Boolean).join(' · ')}</p></div>
            <Button size="icon" variant="ghost" onClick={() => setCandidate({ ...c })} aria-label={`Editar ${c.nome}`}>✎</Button>
            <Button size="icon" variant="destructive" onClick={() => { if (confirm(`Excluir ${c.nome}?`)) void excluirCandidato(c.id).then(() => listarCandidatos(form.id!).then(setCandidatos)).catch((err) => toast.error(err.message)); }} aria-label={`Excluir ${c.nome}`}><Trash2 className="size-4" /></Button>
          </div>)}</div>
          <div className="space-y-3 rounded-xl border border-cyan/20 p-4">
            <h4 className="font-semibold">{candidate.id ? 'Editar candidato' : 'Adicionar candidato'}</h4>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Nome *</Label><Input value={candidate.nome} onChange={(e) => setCandidate({ ...candidate, nome: e.target.value })} /></div><div><Label>Número de votação *</Label><Input type="number" min="0" value={candidate.numero} onChange={(e) => setCandidate({ ...candidate, numero: Number(e.target.value) })} /></div><div><Label>Cargo</Label><Input value={candidate.cargo ?? ''} onChange={(e) => setCandidate({ ...candidate, cargo: e.target.value })} /></div><div><Label>Setor</Label><Input value={candidate.setor ?? ''} onChange={(e) => setCandidate({ ...candidate, setor: e.target.value })} /></div></div>
            <div><Label>Apresentação</Label><Textarea value={candidate.descricao ?? ''} onChange={(e) => setCandidate({ ...candidate, descricao: e.target.value })} /></div>
            <div><Label>Foto</Label><Input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void enviarImagem(file, 'foto'); e.currentTarget.value = ''; }} />{candidate.fotoUrl && <img src={candidate.fotoUrl} alt="Prévia da foto" className="mt-2 size-20 rounded-full object-cover" />}</div>
            <div className="flex gap-2"><Button className="flex-1" disabled={uploading} onClick={() => void salvarCandidatoForm()}>{candidate.id ? 'Atualizar candidato' : 'Adicionar candidato'}</Button>{candidate.id && <Button variant="secondary" onClick={() => setCandidate({ nome: '', numero: 1, cargo: '', setor: '', descricao: '', ordem: 0 })}>Cancelar edição</Button>}</div>
          </div>
        </section>}
      </div>}
    </section>
  </main>;
}

