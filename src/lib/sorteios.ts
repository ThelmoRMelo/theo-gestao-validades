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
    premio1: z.string().trim().min(1, 'Informe o 1º prêmio').max(200),
    premio2: z.string().trim().max(200).default(''),
    premio3: z.string().trim().max(200).default(''),
    regras: z.string().trim().max(2000).default(''),
    status: z.enum(['preparacao', 'publicado', 'encerrado', 'cancelado']),
  })
  .refine((s) => s.numeroFinal > s.numeroInicial, { message: 'Número final deve ser maior que o inicial', path: ['numeroFinal'] })
  .refine((s) => s.numeroFinal - s.numeroInicial + 1 <= 10000, { message: 'Máximo de 10.000 números', path: ['numeroFinal'] });

export type Sorteio = z.infer<typeof sorteioSchema>;

const KEY = 'sorteios_rascunho';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRow = (r: any): Sorteio => ({
  id: r.id, nome: r.nome, descricao: r.descricao ?? '', numeroInicial: r.numero_inicial, numeroFinal: r.numero_final,
  precoUnitario: Number(r.preco_unitario), whatsapp: r.whatsapp, premio1: r.premio1, premio2: r.premio2 ?? '',
  premio3: r.premio3 ?? '', regras: r.regras ?? '', status: r.status as SorteioStatus,
});
const toRow = (s: Sorteio) => ({
  id: s.id, nome: s.nome, descricao: s.descricao, numero_inicial: s.numeroInicial, numero_final: s.numeroFinal,
  preco_unitario: s.precoUnitario, whatsapp: s.whatsapp, premio1: s.premio1, premio2: s.premio2,
  premio3: s.premio3, regras: s.regras, status: s.status,
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
