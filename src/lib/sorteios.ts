import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// Etapa 1: rascunho local apenas para prévia. Persistência no backend vem na Etapa 2.
export type SorteioStatus = 'preparacao' | 'publicado' | 'encerrado' | 'cancelado';

export const STATUS_LABEL: Record<SorteioStatus, string> = {
  preparacao: 'Em preparação',
  publicado: 'Publicado',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const MAX_PREMIOS = 30;
export type Vencedor = { num: number; nome: string };

export const sorteioSchema = z
  .object({
    id: z.string().min(1),
    nome: z.string().trim().min(3, 'Informe o nome (mín. 3 caracteres)').max(100),
    descricao: z.string().trim().max(1000).default(''),
    numeroInicial: z.number().int().min(0, 'Número inicial inválido'),
    numeroFinal: z.number().int(),
    precoUnitario: z.number().positive('Preço deve ser maior que zero').max(1_000_000),
    whatsapp: z
      .string()
      .regex(/^\d{12,13}$/, 'WhatsApp deve ter código do país + DDD + número (ex.: 5585999999999)'),
    premios: z.array(z.string().trim().max(200)).min(1).max(MAX_PREMIOS)
      .refine((l) => l.every((p) => p.length > 0), 'Preencha todos os prêmios (ou reduza a quantidade)'),
    premioUnico: z.boolean().default(false),
    ganhadores: z.array(z.object({ num: z.number(), nome: z.string() }).nullable()).default([]),
    regras: z.string().trim().max(2000).default(''),
    status: z.enum(['preparacao', 'publicado', 'encerrado', 'cancelado']),
    imagemUrl: z.string().optional(), sorteadoEm: z.string().optional(),
  })
  .refine((s) => s.numeroFinal > s.numeroInicial, { message: 'Número final deve ser maior que o inicial', path: ['numeroFinal'] })
  .refine((s) => s.numeroFinal - s.numeroInicial + 1 <= 10000, { message: 'Máximo de 10.000 números', path: ['numeroFinal'] });

export type Sorteio = z.infer<typeof sorteioSchema>;

const KEY = 'sorteios_rascunho';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRow = (r: any): Sorteio => {
  const listaP: string[] = Array.isArray(r.premios_lista) ? r.premios_lista.filter((x: unknown) => typeof x === 'string') : [];
  const legadoP = [r.premio1, r.premio2, r.premio3].filter((p) => p);
  const listaG: (Vencedor | null)[] = Array.isArray(r.ganhadores_lista) ? r.ganhadores_lista : [];
  const legadoG: (Vencedor | null)[] = [1, 2, 3].map((i) => r[`ganhador_${i}_numero`] != null ? { num: r[`ganhador_${i}_numero`], nome: r[`ganhador_${i}_nome`] ?? '' } : null);
  return {
    id: r.id, nome: r.nome, descricao: r.descricao ?? '', numeroInicial: r.numero_inicial, numeroFinal: r.numero_final,
    precoUnitario: Number(r.preco_unitario), whatsapp: r.whatsapp,
    premios: listaP.length ? listaP : legadoP.length ? legadoP : [''],
    premioUnico: !!r.premio_unico_por_participante,
    ganhadores: listaG.length ? listaG : legadoG.some(Boolean) ? legadoG : [],
    regras: r.regras ?? '', status: r.status as SorteioStatus,
    imagemUrl: r.imagem_url ?? undefined, sorteadoEm: r.sorteado_em ?? undefined,
  };
};
// Os 3 primeiros prêmios/ganhadores também vão para as colunas antigas (compatibilidade).
const legadoGanhadores = (g: (Vencedor | null)[]) => Object.fromEntries([0, 1, 2].flatMap((i) => [
  [`ganhador_${i + 1}_numero`, g[i]?.num ?? null], [`ganhador_${i + 1}_nome`, g[i]?.nome ?? null],
]));
const toRow = (s: Sorteio) => ({
  id: s.id, nome: s.nome, descricao: s.descricao, numero_inicial: s.numeroInicial, numero_final: s.numeroFinal,
  preco_unitario: s.precoUnitario, whatsapp: s.whatsapp,
  premio1: s.premios[0] ?? '', premio2: s.premios[1] ?? '', premio3: s.premios[2] ?? '',
  premios_lista: s.premios, premio_unico_por_participante: s.premioUnico, ganhadores_lista: s.ganhadores,
  regras: s.regras, status: s.status,
  imagem_url: s.imagemUrl ?? null, sorteado_em: s.sorteadoEm ?? null,
  ...legadoGanhadores(s.ganhadores),
});

// Envia rascunhos antigos (salvos só no aparelho) para a nuvem uma única vez.
const migrarRascunhos = async () => {
  let locais: Sorteio[] = [];
  try { locais = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* ignore */ }
  if (!locais.length) return;
  const { error } = await supabase.from('sorteios').upsert(locais.map(toRow));
  if (!error) localStorage.removeItem(KEY);
};

export const listSorteios = async (): Promise<Sorteio[]> => {
  await migrarRascunhos();
  const { data, error } = await supabase.from('sorteios').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
};
export const getSorteio = async (id: string) => {
  const { data } = await supabase.from('sorteios').select('*').eq('id', id).maybeSingle();
  return data ? fromRow(data) : undefined;
};
export const saveSorteio = async (s: Sorteio) => {
  const { error } = await supabase.from('sorteios').upsert(toRow(s));
  if (error) throw error;
};
export const deleteSorteio = async (id: string) => {
  const { error } = await supabase.from('sorteios').delete().eq('id', id);
  if (error) throw error;
};

export interface NumeroVendido { id: string; numero: number; comprador_nome: string; comprador_telefone: string; observacao: string; created_at: string; }

export const listVendidos = async (sorteioId: string): Promise<NumeroVendido[]> => {
  const { data, error } = await supabase.from('sorteio_numeros').select('*').eq('sorteio_id', sorteioId).order('numero');
  if (error) throw error;
  return data ?? [];
};
export const listNumerosVendidos = async (sorteioId: string): Promise<number[]> => {
  const { data } = await supabase.from('sorteio_numeros').select('numero').eq('sorteio_id', sorteioId);
  return (data ?? []).map((r) => r.numero);
};
export const darBaixa = async (sorteioId: string, numeros: number[], nome: string, telefone: string, obs: string) => {
  const { error } = await supabase.from('sorteio_numeros').insert(
    numeros.map((numero) => ({ sorteio_id: sorteioId, numero, comprador_nome: nome, comprador_telefone: telefone, observacao: obs })),
  );
  if (error) throw error;
};
export const estornar = async (id: string) => {
  const { error } = await supabase.from('sorteio_numeros').delete().eq('id', id);
  if (error) throw error;
};

/** Converte "7, 14 25-27" em [7,14,25,26,27]. */
export const parseNumeros = (txt: string): number[] => {
  const out = new Set<number>();
  txt.split(/[\s,;]+/).filter(Boolean).forEach((p) => {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b) && out.size < 10000; i++) out.add(i); }
    else if (/^\d+$/.test(p)) out.add(+p);
  });
  return [...out].sort((a, b) => a - b);
};

export const onlyDigits = (v: string) => v.replace(/\D/g, '');
export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const padNum = (n: number, final: number) => String(n).padStart(String(final).length, '0');

export const buildWhatsAppUrl = (s: Sorteio, numeros: number[]) => {
  const ordenados = [...numeros].sort((a, b) => a - b).map((n) => padNum(n, s.numeroFinal));
  const msg = [
    `Olá! Tenho interesse no sorteio *${s.nome}*.`,
    `Números escolhidos: ${ordenados.join(', ')}`,
    `Quantidade: ${numeros.length}`,
    `Preço por número: ${brl(s.precoUnitario)}`,
    `Valor total: ${brl(s.precoUnitario * numeros.length)}`,
    '',
    'Poderia me enviar as instruções para pagamento e confirmação da aquisição?',
  ].join('\n');
  return `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(msg)}`;
};


const PREVIEW_URL = 'https://svbocyguwvhkljzenlnb.supabase.co/functions/v1/sorteio-preview';
// `v` muda quando o banner muda, forçando o WhatsApp a buscar a prévia nova (ele guarda cache por link).
const versao = (imagemUrl?: string) => (imagemUrl ? (imagemUrl.split('/').pop() ?? '').split('.')[0].slice(0, 8) : '');
export const getShareUrl = (id: string, imagemUrl?: string) => {
  const v = versao(imagemUrl);
  return `${PREVIEW_URL}?id=${encodeURIComponent(id)}${v ? `&v=${v}` : ''}`;
};
export const getBannerUrl = (id: string, imagemUrl?: string) => {
  const v = versao(imagemUrl);
  return `${PREVIEW_URL}?id=${encodeURIComponent(id)}&img=1${v ? `&v=${v}` : ''}`;
};

// Reduz a imagem para no máx. 1200px (sem cortar) em JPEG leve (< ~300KB),
// limite necessário para o WhatsApp exibir o banner na prévia do link.
const comprimirBanner = async (file: File): Promise<Blob> => {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  for (const q of [0.82, 0.72, 0.62, 0.5]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && (blob.size <= 300_000 || q === 0.5)) return blob;
  }
  throw new Error('Falha ao comprimir imagem');
};

export const uploadBannerSorteio = async (sorteioId: string, file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem');
  const blob = await comprimirBanner(file);
  const path = `${sorteioId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('sorteios').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { error: updateError } = await supabase.from('sorteios').update({ imagem_url: path }).eq('id', sorteioId);
  if (updateError) throw updateError;
  return path;
};

/** Chave que identifica a mesma pessoa: telefone (só dígitos) ou nome normalizado. */
export const chavePessoa = (nome: string, telefone?: string) => {
  const t = onlyDigits(telefone ?? '');
  return t.length >= 8 ? `t:${t.slice(-8)}` : `n:${nome.trim().toLowerCase()}`;
};

export const homologarApuracao = async (sorteioId: string, ganhadores: (Vencedor | null)[]) => {
  const { error } = await supabase.from('sorteios').update({
    status: 'encerrado', sorteado_em: new Date().toISOString(),
    ganhadores_lista: ganhadores, ...legadoGanhadores(ganhadores),
  }).eq('id', sorteioId);
  if (error) throw error;
};
