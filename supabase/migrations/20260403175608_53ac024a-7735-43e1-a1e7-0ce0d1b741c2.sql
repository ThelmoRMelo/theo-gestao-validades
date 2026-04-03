
-- Tabela de setores de metas
CREATE TABLE public.metas_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  percentual NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.metas_setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read metas_setores" ON public.metas_setores FOR SELECT TO public USING (true);
CREATE POLICY "Allow insert metas_setores" ON public.metas_setores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow update metas_setores" ON public.metas_setores FOR UPDATE TO public USING (true);

-- Tabela de metas mensais
CREATE TABLE public.metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  meta_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ano, mes)
);

ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read metas_mensais" ON public.metas_mensais FOR SELECT TO public USING (true);
CREATE POLICY "Allow insert metas_mensais" ON public.metas_mensais FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow update metas_mensais" ON public.metas_mensais FOR UPDATE TO public USING (true);

-- Tabela de vendas
CREATE TABLE public.metas_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id UUID NOT NULL REFERENCES public.metas_setores(id),
  valor NUMERIC NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.metas_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read metas_vendas" ON public.metas_vendas FOR SELECT TO public USING (true);
CREATE POLICY "Allow insert metas_vendas" ON public.metas_vendas FOR INSERT TO public WITH CHECK (true);

-- Habilitar realtime para vendas
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_vendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_mensais;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_setores;
