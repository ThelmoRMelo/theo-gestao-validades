import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

export type EleicaoTipo = 'cipa' | 'funcionario_mes' | 'lideranca' | 'geral';
export type EleicaoStatus = 'preparacao' | 'aberta' | 'encerrada';
export type EleitorStatus = 'apto' | 'habilitado' | 'votou';

export const TIPO_LABEL: Record<EleicaoTipo, string> = {
  cipa: 'Comissão Interna (CIPA)',
  funcionario_mes: 'Funcionário do Mês / Destaque',
  lideranca: 'Liderança / Representante',
  geral: 'Votação Geral / Personalizada',
};
export const STATUS_LABEL: Record<EleicaoStatus, string> = {
  preparacao: 'Em Preparação', aberta: 'Votação Aberta', encerrada: 'Encerrada',
};

export interface Eleicao {
  id: string; titulo: string; descricao: string; tipo: EleicaoTipo; regras: string;
  status: EleicaoStatus; imagemUrl?: string; permitirEleitorAvulso: boolean;
  permitirVotoBranco: boolean; dataInicio?: string; dataFim?: string;
  encerradaEm?: string; createdAt: string;
}
export interface Candidato {
  id: string; eleicaoId: string; numero: number; nome: string; cargo: string;
  setor: string; descricao: string; fotoUrl?: string; ordem: number;
}
export interface Eleitor {
  id: string; eleicaoId: string; nome: string; funcao: string; matricula: string;
  preCadastrado: boolean; status: EleitorStatus; cabine: string;
  habilitadoEm?: string; votouEm?: string;
}
export interface ResultadoItem { candidatoId: string | null; numero: number | null; nome: string; votos: number }

export const eleicaoSchema = z.object({
  titulo: z.string().trim().min(3, 'Informe um título com pelo menos 3 caracteres.').max(120),
  descricao: z.string().max(2000).default(''),
  tipo: z.enum(['cipa', 'funcionario_mes', 'lideranca', 'geral']).default('geral'),
  regras: z.string().max(4000).default(''),
  status: z.enum(['preparacao', 'aberta', 'encerrada']).default('preparacao'),
  imagemUrl: z.string().nullable().optional(),
  permitirEleitorAvulso: z.boolean().default(true),
  permitirVotoBranco: z.boolean().default(true),
});

export async function comprimirImagem(file: File, maxDim = 1200, maxKb = 300): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Não foi possível abrir esta imagem.'));
      img.src = url;
    });
  } finally { URL.revokeObjectURL(url); }

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const ratio = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
  const limite = maxKb * 1024;
  for (let escala = 1; escala >= 0.35; escala *= 0.85) {
    canvas.width = Math.max(1, Math.round(width * escala));
    canvas.height = Math.max(1, Math.round(height * escala));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (let qualidade = 0.86; qualidade >= 0.4; qualidade -= 0.1) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade));
      if (blob && blob.size <= limite) return blob;
    }
  }
  throw new Error(`A imagem não pôde ser reduzida para menos de ${maxKb} KB.`);
}

export async function uploadImagemEleicao(file: File, pasta = 'banners'): Promise<string> {
  const blob = await comprimirImagem(file);
  const nomeArquivo = `${pasta}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('eleicoes').upload(nomeArquivo, blob, {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('eleicoes').getPublicUrl(nomeArquivo).data.publicUrl;
}

let audioContext: AudioContext | null = null;
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || w.webkitAudioContext;
    if (!Ctx) return null;
    audioContext ??= new Ctx();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);
    return audioContext;
  } catch { return null; }
}
export const playSomUrna = {
  tecla: () => {
    const ctx = getAudioContext(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(650, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.08);
  },
  fim: () => {
    const ctx = getAudioContext(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain(); const now = ctx.currentTime;
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1100, now + 0.15);
    gain.gain.setValueAtTime(0.2, now); gain.gain.setValueAtTime(0.2, now + 0.6); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.85);
  },
};

const mapEleicao = (r: any): Eleicao => ({
  id: r.id, titulo: r.titulo, descricao: r.descricao ?? '', tipo: r.tipo as EleicaoTipo,
  regras: r.regras ?? '', status: r.status as EleicaoStatus, imagemUrl: r.imagem_url ?? undefined,
  permitirEleitorAvulso: r.permitir_eleitor_avulso, permitirVotoBranco: r.permitir_voto_branco,
  dataInicio: r.data_inicio ?? undefined, dataFim: r.data_fim ?? undefined,
  encerradaEm: r.encerrada_em ?? undefined, createdAt: r.created_at,
});
const mapCandidato = (c: any): Candidato => ({
  id: c.id, eleicaoId: c.eleicao_id, numero: c.numero, nome: c.nome, cargo: c.cargo ?? '',
  setor: c.setor ?? '', descricao: c.descricao ?? '', fotoUrl: c.foto_url ?? undefined, ordem: c.ordem,
});
const mapEleitor = (e: any): Eleitor => ({
  id: e.id, eleicaoId: e.eleicao_id, nome: e.nome, funcao: e.funcao ?? '', matricula: e.matricula ?? '',
  preCadastrado: e.pre_cadastrado, status: e.status as EleitorStatus, cabine: e.cabine ?? '',
  habilitadoEm: e.habilitado_em ?? undefined, votouEm: e.votou_em ?? undefined,
});

export async function listarEleicoes(): Promise<Eleicao[]> {
  const { data, error } = await supabase.from('eleicoes').select('*').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []).map(mapEleicao);
}
export async function obterEleicao(id: string): Promise<Eleicao | null> {
  const { data, error } = await supabase.from('eleicoes').select('*').eq('id', id).maybeSingle();
  if (error) throw error; return data ? mapEleicao(data) : null;
}
export async function salvarEleicao(e: Partial<Eleicao> & { titulo: string }): Promise<string> {
  const payload = {
    titulo: e.titulo, descricao: e.descricao ?? '', tipo: e.tipo ?? 'geral', regras: e.regras ?? '',
    status: e.status ?? 'preparacao', imagem_url: e.imagemUrl ?? null,
    permitir_eleitor_avulso: e.permitirEleitorAvulso ?? true, permitir_voto_branco: e.permitirVotoBranco ?? true,
  };
  if (e.id) { const { error } = await supabase.from('eleicoes').update(payload).eq('id', e.id); if (error) throw error; return e.id; }
  const { data, error } = await supabase.from('eleicoes').insert(payload).select('id').single();
  if (error) throw error; return data.id;
}
export async function excluirEleicao(id: string) { const { error } = await supabase.from('eleicoes').delete().eq('id', id); if (error) throw error; }

export async function listarCandidatos(eleicaoId: string): Promise<Candidato[]> {
  const { data, error } = await supabase.from('eleicao_candidatos').select('*').eq('eleicao_id', eleicaoId).order('numero');
  if (error) throw error; return (data ?? []).map(mapCandidato);
}
export async function salvarCandidato(c: Partial<Candidato> & { eleicaoId: string; numero: number; nome: string }) {
  const payload = { eleicao_id: c.eleicaoId, numero: c.numero, nome: c.nome, cargo: c.cargo ?? '', setor: c.setor ?? '', descricao: c.descricao ?? '', foto_url: c.fotoUrl ?? null, ordem: c.ordem ?? 0 };
  if (c.id) { const { error } = await supabase.from('eleicao_candidatos').update(payload).eq('id', c.id); if (error) throw error; }
  else { const { error } = await supabase.from('eleicao_candidatos').insert(payload); if (error) throw error; }
}
export async function excluirCandidato(id: string) { const { error } = await supabase.from('eleicao_candidatos').delete().eq('id', id); if (error) throw error; }

export async function listarEleitores(eleicaoId: string): Promise<Eleitor[]> {
  const { data, error } = await supabase.from('eleicao_eleitores').select('*').eq('eleicao_id', eleicaoId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []).map(mapEleitor);
}
export async function salvarEleitor(eleicaoId: string, eleitor: { nome: string; funcao?: string; matricula?: string }) {
  const { error } = await supabase.from('eleicao_eleitores').insert({ eleicao_id: eleicaoId, nome: eleitor.nome, funcao: eleitor.funcao ?? '', matricula: eleitor.matricula ?? '', pre_cadastrado: true, status: 'apto' });
  if (error) throw error;
}
export async function habilitarEleitor(params: { eleicaoId: string; nome: string; funcao?: string; matricula?: string; cabine?: string }) {
  const { data, error } = await supabase.rpc('habilitar_eleitor', { _eleicao_id: params.eleicaoId, _nome: params.nome, _funcao: params.funcao ?? '', _matricula: params.matricula ?? '', _cabine: params.cabine ?? '' });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error));
  return data;
}
export async function cancelarHabilitacao(eleitorId: string) { const { error } = await supabase.rpc('cancelar_habilitacao', { _eleitor_id: eleitorId }); if (error) throw error; }
export async function obterSessaoCabine(eleicaoId: string, cabine = ''): Promise<{ eleitor_id: string; nome: string; funcao: string; habilitado_em: string } | null> {
  const { data, error } = await supabase.rpc('sessao_cabine', { _eleicao_id: eleicaoId, _cabine: cabine });
  if (error) throw error; return data as unknown as { eleitor_id: string; nome: string; funcao: string; habilitado_em: string } | null;
}
export async function computarVoto(eleitorId: string, candidatoId: string | null) {
  // A RPC aceita NULL para voto branco; o tipo gerado atualmente declara string obrigatória.
  const rpc = supabase.rpc as unknown as (name: string, args: { _eleitor_id: string; _candidato_id: string | null }) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc('computar_voto', { _eleitor_id: eleitorId, _candidato_id: candidatoId }); if (error) throw new Error(error.message);
}
export async function apurarResultados(eleicaoId: string): Promise<ResultadoItem[]> {
  const { data, error } = await supabase.rpc('apurar_eleicao', { _eleicao_id: eleicaoId });
  if (error) throw error;
  return (data ?? []).map((r) => ({ candidatoId: r.candidato_id ?? null, numero: r.numero ?? null, nome: r.nome ?? 'Voto em branco', votos: Number(r.votos) || 0 }));
}
export async function encerrarEleicao(eleicaoId: string) { const { error } = await supabase.rpc('encerrar_eleicao', { _eleicao_id: eleicaoId }); if (error) throw error; }
