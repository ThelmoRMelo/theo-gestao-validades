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

// Converte qualquer imagem (PNG, WEBP, HEIC suportado pelo navegador, JPEG...) em JPEG leve.
async function abrirImagem(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close?.() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('Formato de imagem não suportado neste aparelho.')); img.src = url; });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }
}
export async function comprimirImagem(file: File, maxDim = 1200, maxKb = 300): Promise<Blob> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp|gif|bmp)$/i.test(file.name)) throw new Error('Selecione um arquivo de imagem.');
  const im = await abrirImagem(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) { im.close(); throw new Error('Seu navegador não conseguiu processar a imagem.'); }
  const limite = maxKb * 1024;
  let ultimo: Blob | null = null;
  try {
    const base = Math.min(1, maxDim / Math.max(im.w, im.h));
    for (let escala = base; escala >= base * 0.4; escala *= 0.8) {
      canvas.width = Math.max(1, Math.round(im.w * escala));
      canvas.height = Math.max(1, Math.round(im.h * escala));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(im.src, 0, 0, canvas.width, canvas.height);
      for (const q of [0.85, 0.72, 0.6, 0.5]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
        if (blob) { ultimo = blob; if (blob.size <= limite) return blob; }
      }
    }
  } finally { im.close(); }
  if (ultimo) return ultimo;
  throw new Error('Não foi possível converter a imagem.');
}

const BUCKET = 'eleicoes';
/** Extrai o caminho no armazenamento a partir de um link antigo (público/assinado) ou caminho puro. */
export const caminhoImagem = (v?: string | null) => {
  if (!v) return undefined;
  if (v.startsWith('blob:')) return undefined;
  const m = v.match(/\/object\/(?:public|sign)\/eleicoes\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : v;
};
const cacheAssinado = new Map<string, string>();
/** Gera links assinados (válidos por 1 ano) para exibir imagens do armazenamento privado. */
async function assinar(caminhos: (string | undefined)[]): Promise<Map<string, string>> {
  const faltam = [...new Set(caminhos.filter((c): c is string => !!c && !/^https?:/.test(c) && !cacheAssinado.has(c)))];
  if (faltam.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(faltam, 60 * 60 * 24 * 365);
    (data ?? []).forEach((d) => { if (d.path && d.signedUrl) cacheAssinado.set(d.path, d.signedUrl); });
  }
  return cacheAssinado;
}
const exibir = (c: string | undefined, mapa: Map<string, string>) => (c ? mapa.get(c) ?? (/^https?:/.test(c) ? c : undefined) : undefined);

export async function uploadImagemEleicao(file: File, pasta = 'banners'): Promise<string> {
  const blob = pasta === 'candidatos' ? await comprimirImagem(file, 600, 120) : await comprimirImagem(file, 1200, 300);
  const nomeArquivo = `${pasta}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(nomeArquivo, blob, {
    contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
  });
  if (error) throw error;
  const mapa = await assinar([nomeArquivo]);
  return mapa.get(nomeArquivo) ?? nomeArquivo;
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
