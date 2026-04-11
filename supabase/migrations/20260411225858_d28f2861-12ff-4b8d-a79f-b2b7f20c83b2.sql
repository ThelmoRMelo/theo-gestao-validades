
-- Create table for weekly day weights
CREATE TABLE public.metas_pesos_semana (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana integer NOT NULL UNIQUE CHECK (dia_semana >= 0 AND dia_semana <= 6),
  peso numeric NOT NULL DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.metas_pesos_semana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read metas_pesos_semana" ON public.metas_pesos_semana FOR SELECT USING (true);
CREATE POLICY "Allow insert metas_pesos_semana" ON public.metas_pesos_semana FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update metas_pesos_semana" ON public.metas_pesos_semana FOR UPDATE USING (true);

-- Insert default values
INSERT INTO public.metas_pesos_semana (dia_semana, peso) VALUES
  (0, 0.5),
  (1, 1.0),
  (2, 1.0),
  (3, 1.0),
  (4, 1.0),
  (5, 1.1),
  (6, 1.2);
