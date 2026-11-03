CREATE OR REPLACE FUNCTION public.normalizar_texto(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT regexp_replace(lower(translate(trim(coalesce(_t,'')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g');
$$;

CREATE TABLE public.eleicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'geral',
  regras text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'preparacao' CHECK (status IN ('preparacao','aberta','encerrada')),
  imagem_url text,
  permitir_eleitor_avulso boolean NOT NULL DEFAULT true,
  permitir_voto_branco boolean NOT NULL DEFAULT true,
  data_inicio timestamptz,
  data_fim timestamptz,
  encerrada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eleicoes TO anon, authenticated;
GRANT ALL ON public.eleicoes TO service_role;
ALTER TABLE public.eleicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read eleicoes" ON public.eleicoes FOR SELECT USING (true);
CREATE POLICY "Allow insert eleicoes" ON public.eleicoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update eleicoes" ON public.eleicoes FOR UPDATE USING (true);
CREATE POLICY "Allow delete eleicoes" ON public.eleicoes FOR DELETE USING (true);
CREATE TRIGGER update_eleicoes_updated_at BEFORE UPDATE ON public.eleicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.eleicao_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleicao_id uuid NOT NULL REFERENCES public.eleicoes(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  nome text NOT NULL,
  cargo text NOT NULL DEFAULT '',
  setor text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  foto_url text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eleicao_id, numero)
);
CREATE INDEX idx_eleicao_candidatos_eleicao ON public.eleicao_candidatos(eleicao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eleicao_candidatos TO anon, authenticated;
GRANT ALL ON public.eleicao_candidatos TO service_role;
ALTER TABLE public.eleicao_candidatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read eleicao_candidatos" ON public.eleicao_candidatos FOR SELECT USING (true);
CREATE POLICY "Allow insert eleicao_candidatos" ON public.eleicao_candidatos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update eleicao_candidatos" ON public.eleicao_candidatos FOR UPDATE USING (true);
CREATE POLICY "Allow delete eleicao_candidatos" ON public.eleicao_candidatos FOR DELETE USING (true);

CREATE TABLE public.eleicao_eleitores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleicao_id uuid NOT NULL REFERENCES public.eleicoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text NOT NULL DEFAULT '',
  matricula text NOT NULL DEFAULT '',
  chave text NOT NULL DEFAULT '',
  pre_cadastrado boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'apto' CHECK (status IN ('apto','habilitado','votou')),
  cabine text NOT NULL DEFAULT '',
  habilitado_em timestamptz,
  votou_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eleicao_id, chave)
);
CREATE INDEX idx_eleicao_eleitores_status ON public.eleicao_eleitores(eleicao_id, status);
GRANT SELECT, INSERT, DELETE ON public.eleicao_eleitores TO anon, authenticated;
GRANT ALL ON public.eleicao_eleitores TO service_role;
ALTER TABLE public.eleicao_eleitores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read eleicao_eleitores" ON public.eleicao_eleitores FOR SELECT USING (true);
CREATE POLICY "Allow pre-cadastro eleicao_eleitores" ON public.eleicao_eleitores FOR INSERT WITH CHECK (status = 'apto');
CREATE POLICY "Allow delete eleitor sem voto" ON public.eleicao_eleitores FOR DELETE USING (status <> 'votou');

-- Chave anti-duplicidade: matrícula (se houver) senão nome + função normalizados
CREATE OR REPLACE FUNCTION public.eleitor_preencher_chave()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.nome := regexp_replace(trim(NEW.nome), '\s+', ' ', 'g');
  NEW.funcao := trim(coalesce(NEW.funcao,''));
  NEW.matricula := trim(coalesce(NEW.matricula,''));
  IF length(NEW.nome) < 2 THEN RAISE EXCEPTION 'Informe o nome do eleitor.'; END IF;
  NEW.chave := CASE WHEN NEW.matricula <> '' THEN 'm:' || public.normalizar_texto(NEW.matricula)
               ELSE 'n:' || public.normalizar_texto(NEW.nome) || '|' || public.normalizar_texto(NEW.funcao) END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_eleitor_chave BEFORE INSERT OR UPDATE OF nome, funcao, matricula ON public.eleicao_eleitores
  FOR EACH ROW EXECUTE FUNCTION public.eleitor_preencher_chave();

-- Urna sigilosa: sem eleitor e sem horário
CREATE TABLE public.eleicao_votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleicao_id uuid NOT NULL REFERENCES public.eleicoes(id) ON DELETE CASCADE,
  candidato_id uuid REFERENCES public.eleicao_candidatos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'candidato' CHECK (tipo IN ('candidato','branco'))
);
CREATE INDEX idx_eleicao_votos_eleicao ON public.eleicao_votos(eleicao_id);
GRANT ALL ON public.eleicao_votos TO service_role;
ALTER TABLE public.eleicao_votos ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.eleicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eleicao_candidatos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eleicao_eleitores;

-- Mesário libera o voto (cria o eleitor na hora se permitido)
CREATE OR REPLACE FUNCTION public.habilitar_eleitor(_eleicao_id uuid, _nome text, _funcao text DEFAULT '', _matricula text DEFAULT '', _cabine text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.eleicoes; el public.eleicao_eleitores; k text; cab text := trim(coalesce(_cabine,''));
BEGIN
  SELECT * INTO e FROM public.eleicoes WHERE id = _eleicao_id FOR UPDATE;
  IF NOT FOUND OR e.status <> 'aberta' THEN RAISE EXCEPTION 'A votação desta eleição não está aberta.'; END IF;
  IF length(trim(coalesce(_nome,''))) < 2 THEN RAISE EXCEPTION 'Informe o nome do eleitor.'; END IF;
  k := CASE WHEN trim(coalesce(_matricula,'')) <> '' THEN 'm:' || public.normalizar_texto(_matricula)
       ELSE 'n:' || public.normalizar_texto(_nome) || '|' || public.normalizar_texto(_funcao) END;
  SELECT * INTO el FROM public.eleicao_eleitores WHERE eleicao_id = e.id AND chave = k FOR UPDATE;
  IF FOUND THEN
    IF el.status = 'votou' THEN
      RAISE EXCEPTION 'Atenção: % já votou em % às %.', el.nome,
        to_char(el.votou_em AT TIME ZONE 'America/Fortaleza','DD/MM'), to_char(el.votou_em AT TIME ZONE 'America/Fortaleza','HH24:MI');
    END IF;
    IF el.status = 'habilitado' THEN RAISE EXCEPTION '% já está liberado(a) para votar.', el.nome; END IF;
  ELSIF NOT e.permitir_eleitor_avulso THEN
    RAISE EXCEPTION 'Eleitor não consta na lista de aptos desta eleição.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.eleicao_eleitores WHERE eleicao_id = e.id AND status = 'habilitado' AND cabine = cab) THEN
    RAISE EXCEPTION 'Já existe um eleitor liberado nesta cabine. Aguarde o voto ou cancele a liberação.';
  END IF;
  IF el.id IS NULL THEN
    INSERT INTO public.eleicao_eleitores(eleicao_id, nome, funcao, matricula, status, cabine, habilitado_em)
    VALUES (e.id, _nome, coalesce(_funcao,''), coalesce(_matricula,''), 'habilitado', cab, now()) RETURNING * INTO el;
  ELSE
    UPDATE public.eleicao_eleitores SET status = 'habilitado', cabine = cab, habilitado_em = now() WHERE id = el.id RETURNING * INTO el;
  END IF;
  RETURN jsonb_build_object('id', el.id, 'nome', el.nome, 'funcao', el.funcao, 'cabine', el.cabine, 'habilitado_em', el.habilitado_em);
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_habilitacao(_eleitor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.eleicao_eleitores SET status = 'apto', cabine = '', habilitado_em = NULL
  WHERE id = _eleitor_id AND status = 'habilitado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liberação não encontrada ou o voto já foi registrado.'; END IF;
END $$;

-- Cabine pergunta quem está liberado para ela
CREATE OR REPLACE FUNCTION public.sessao_cabine(_eleicao_id uuid, _cabine text DEFAULT '')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('eleitor_id', el.id, 'nome', el.nome, 'funcao', el.funcao, 'habilitado_em', el.habilitado_em)
  FROM public.eleicao_eleitores el JOIN public.eleicoes e ON e.id = el.eleicao_id
  WHERE el.eleicao_id = _eleicao_id AND el.status = 'habilitado' AND el.cabine = trim(coalesce(_cabine,'')) AND e.status = 'aberta'
  ORDER BY el.habilitado_em LIMIT 1;
$$;

-- Voto atômico: marca presença e deposita na urna sem vínculo
CREATE OR REPLACE FUNCTION public.computar_voto(_eleitor_id uuid, _candidato_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE el public.eleicao_eleitores; e public.eleicoes;
BEGIN
  SELECT * INTO el FROM public.eleicao_eleitores WHERE id = _eleitor_id FOR UPDATE;
  IF NOT FOUND OR el.status <> 'habilitado' THEN RAISE EXCEPTION 'Voto não liberado. Procure o mesário.'; END IF;
  SELECT * INTO e FROM public.eleicoes WHERE id = el.eleicao_id;
  IF e.status <> 'aberta' THEN RAISE EXCEPTION 'A votação foi encerrada.'; END IF;
  IF _candidato_id IS NULL THEN
    IF NOT e.permitir_voto_branco THEN RAISE EXCEPTION 'Voto em branco não é permitido nesta eleição.'; END IF;
    INSERT INTO public.eleicao_votos(eleicao_id, candidato_id, tipo) VALUES (e.id, NULL, 'branco');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.eleicao_candidatos WHERE id = _candidato_id AND eleicao_id = e.id) THEN
      RAISE EXCEPTION 'Candidato inválido.'; END IF;
    INSERT INTO public.eleicao_votos(eleicao_id, candidato_id, tipo) VALUES (e.id, _candidato_id, 'candidato');
  END IF;
  UPDATE public.eleicao_eleitores SET status = 'votou', votou_em = now() WHERE id = el.id;
END $$;

-- Totais por candidato (+ linha de brancos com candidato_id nulo)
CREATE OR REPLACE FUNCTION public.apurar_eleicao(_eleicao_id uuid)
RETURNS TABLE(candidato_id uuid, numero integer, nome text, votos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.numero, c.nome, count(v.id)
  FROM public.eleicao_candidatos c LEFT JOIN public.eleicao_votos v ON v.candidato_id = c.id
  WHERE c.eleicao_id = _eleicao_id GROUP BY c.id, c.numero, c.nome
  UNION ALL
  SELECT NULL::uuid, NULL::integer, 'Branco', count(*) FROM public.eleicao_votos
  WHERE eleicao_id = _eleicao_id AND tipo = 'branco'
  ORDER BY 4 DESC, 2;
$$;

CREATE OR REPLACE FUNCTION public.encerrar_eleicao(_eleicao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.eleicoes SET status = 'encerrada', encerrada_em = now() WHERE id = _eleicao_id AND status <> 'encerrada';
  UPDATE public.eleicao_eleitores SET status = 'apto', cabine = '', habilitado_em = NULL WHERE eleicao_id = _eleicao_id AND status = 'habilitado';
END $$;

GRANT EXECUTE ON FUNCTION public.habilitar_eleitor(uuid,text,text,text,text), public.cancelar_habilitacao(uuid),
  public.sessao_cabine(uuid,text), public.computar_voto(uuid,uuid), public.apurar_eleicao(uuid),
  public.encerrar_eleicao(uuid), public.normalizar_texto(text) TO anon, authenticated;