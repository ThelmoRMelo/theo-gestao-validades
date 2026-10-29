CREATE TABLE public.sorteios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  numero_inicial integer NOT NULL,
  numero_final integer NOT NULL,
  preco_unitario numeric NOT NULL,
  whatsapp text NOT NULL,
  premio1 text NOT NULL,
  premio2 text NOT NULL DEFAULT '',
  premio3 text NOT NULL DEFAULT '',
  regras text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'preparacao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteios TO anon, authenticated;
GRANT ALL ON public.sorteios TO service_role;
ALTER TABLE public.sorteios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read sorteios" ON public.sorteios FOR SELECT USING (true);
CREATE POLICY "Allow insert sorteios" ON public.sorteios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update sorteios" ON public.sorteios FOR UPDATE USING (true);
CREATE POLICY "Allow delete sorteios" ON public.sorteios FOR DELETE USING (true);
CREATE TRIGGER update_sorteios_updated_at BEFORE UPDATE ON public.sorteios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sorteio_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  comprador_nome text NOT NULL,
  comprador_telefone text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sorteio_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_numeros TO anon, authenticated;
GRANT ALL ON public.sorteio_numeros TO service_role;
ALTER TABLE public.sorteio_numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read sorteio_numeros" ON public.sorteio_numeros FOR SELECT USING (true);
CREATE POLICY "Allow insert sorteio_numeros" ON public.sorteio_numeros FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update sorteio_numeros" ON public.sorteio_numeros FOR UPDATE USING (true);
CREATE POLICY "Allow delete sorteio_numeros" ON public.sorteio_numeros FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sorteios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sorteio_numeros;