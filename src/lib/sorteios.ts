import { z } from 'zod';

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

export const listSorteios = (): Sorteio[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
export const getSorteio = (id: string) => listSorteios().find((s) => s.id === id);
export const saveSorteio = (s: Sorteio) => {
  const all = listSorteios().filter((x) => x.id !== s.id);
  localStorage.setItem(KEY, JSON.stringify([s, ...all]));
};
export const deleteSorteio = (id: string) =>
  localStorage.setItem(KEY, JSON.stringify(listSorteios().filter((s) => s.id !== id)));

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
