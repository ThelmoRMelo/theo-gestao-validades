ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS premios_lista jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ganhadores_lista jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS premio_unico_por_participante boolean NOT NULL DEFAULT false;