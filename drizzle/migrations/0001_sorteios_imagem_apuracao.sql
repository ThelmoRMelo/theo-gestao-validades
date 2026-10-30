ALTER TABLE public.sorteios
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS sorteado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ganhador_1_numero integer,
  ADD COLUMN IF NOT EXISTS ganhador_1_nome text,
  ADD COLUMN IF NOT EXISTS ganhador_2_numero integer,
  ADD COLUMN IF NOT EXISTS ganhador_2_nome text,
  ADD COLUMN IF NOT EXISTS ganhador_3_numero integer,
  ADD COLUMN IF NOT EXISTS ganhador_3_nome text;