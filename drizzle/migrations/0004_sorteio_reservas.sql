CREATE TABLE public.sorteio_reservas (
  id uuid PRIMARY KEY,
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  numeros integer[] NOT NULL,
  comprador_nome varchar(120) NOT NULL,
  comprador_telefone varchar(15) NOT NULL,
  preco_unitario numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','cancelado')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sorteio_reservas_ativas ON public.sorteio_reservas (sorteio_id, status, expires_at);
CREATE INDEX idx_sorteio_reservas_numeros ON public.sorteio_reservas USING gin (numeros);

GRANT SELECT ON public.sorteio_reservas TO anon, authenticated;
GRANT ALL ON public.sorteio_reservas TO service_role;
ALTER TABLE public.sorteio_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read sorteio_reservas" ON public.sorteio_reservas FOR SELECT TO public USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.sorteio_reservas;

CREATE OR REPLACE FUNCTION public.reservar_numeros(_sorteio_id uuid, _pedido_id uuid, _numeros integer[], _nome text, _telefone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.sorteios; r public.sorteio_reservas; ns integer[]; tel text := regexp_replace(coalesce(_telefone,''), '\D', '', 'g');
BEGIN
  SELECT * INTO s FROM public.sorteios WHERE id = _sorteio_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'publicado' THEN RAISE EXCEPTION 'Este sorteio não está aberto.'; END IF;
  SELECT array_agg(DISTINCT n ORDER BY n) INTO ns FROM unnest(_numeros) n;
  IF ns IS NULL OR cardinality(ns) > 100 OR EXISTS (SELECT 1 FROM unnest(ns) n WHERE n < s.numero_inicial OR n > s.numero_final) THEN
    RAISE EXCEPTION 'Escolha de 1 a 100 números válidos.'; END IF;
  IF length(trim(coalesce(_nome,''))) NOT BETWEEN 2 AND 120 OR length(tel) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'Informe nome e telefone válidos.'; END IF;
  SELECT * INTO r FROM public.sorteio_reservas WHERE id = _pedido_id;
  IF FOUND THEN
    IF r.sorteio_id = _sorteio_id AND r.numeros = ns AND r.status = 'pendente' AND r.expires_at > now() THEN
      RETURN jsonb_build_object('id', r.id, 'expires_at', r.expires_at, 'preco_unitario', r.preco_unitario);
    END IF;
    RAISE EXCEPTION 'Este pedido já foi utilizado. Faça uma nova reserva.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sorteio_numeros WHERE sorteio_id = s.id AND numero = ANY(ns))
     OR EXISTS (SELECT 1 FROM public.sorteio_reservas WHERE sorteio_id = s.id AND status = 'pendente' AND expires_at > now() AND numeros && ns) THEN
    RAISE EXCEPTION 'Algum número acabou de ser vendido ou reservado por outro participante. Escolha novamente.';
  END IF;
  IF (SELECT count(*) FROM public.sorteio_reservas WHERE sorteio_id = s.id AND comprador_telefone = tel AND status = 'pendente' AND expires_at > now()) >= 3 THEN
    RAISE EXCEPTION 'Você já possui 3 pedidos pendentes neste sorteio. Aguarde a confirmação ou liberação.';
  END IF;
  INSERT INTO public.sorteio_reservas(id, sorteio_id, numeros, comprador_nome, comprador_telefone, preco_unitario)
  VALUES (_pedido_id, s.id, ns, trim(_nome), tel, s.preco_unitario) RETURNING * INTO r;
  RETURN jsonb_build_object('id', r.id, 'expires_at', r.expires_at, 'preco_unitario', r.preco_unitario);
END $$;

CREATE OR REPLACE FUNCTION public.numeros_reservados(_sorteio_id uuid)
RETURNS SETOF integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT unnest(r.numeros) FROM public.sorteio_reservas r JOIN public.sorteios s ON s.id = r.sorteio_id
  WHERE r.sorteio_id = _sorteio_id AND r.status = 'pendente' AND r.expires_at > now() AND s.status = 'publicado';
$$;

CREATE OR REPLACE FUNCTION public.resolver_reserva(_pedido_id uuid, _confirmar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.sorteio_reservas; sid uuid;
BEGIN
  SELECT sorteio_id INTO sid FROM public.sorteio_reservas WHERE id = _pedido_id;
  IF sid IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  PERFORM 1 FROM public.sorteios WHERE id = sid FOR UPDATE;
  SELECT * INTO r FROM public.sorteio_reservas WHERE id = _pedido_id FOR UPDATE;
  IF r.status = 'confirmado' AND _confirmar THEN RETURN; END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Este pedido já foi finalizado.'; END IF;
  IF _confirmar THEN
    IF r.expires_at <= now() THEN RAISE EXCEPTION 'Reserva expirada. Os números precisam ser escolhidos novamente.'; END IF;
    UPDATE public.sorteio_reservas SET status = 'confirmado' WHERE id = r.id;
    INSERT INTO public.sorteio_numeros(sorteio_id, numero, comprador_nome, comprador_telefone, observacao)
    SELECT r.sorteio_id, n, r.comprador_nome, r.comprador_telefone, 'Pedido ' || r.id::text FROM unnest(r.numeros) n;
  ELSE
    UPDATE public.sorteio_reservas SET status = 'cancelado' WHERE id = r.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validar_baixa_reserva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sorteio_reservas WHERE sorteio_id = NEW.sorteio_id AND status = 'pendente' AND expires_at > now() AND NEW.numero = ANY(numeros)) THEN
    RAISE EXCEPTION 'O número % já está reservado. Confirme o pedido correspondente na lista de reservas pendentes.', NEW.numero;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_baixa_reserva BEFORE INSERT ON public.sorteio_numeros FOR EACH ROW EXECUTE FUNCTION public.validar_baixa_reserva();

GRANT EXECUTE ON FUNCTION public.reservar_numeros(uuid, uuid, integer[], text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.numeros_reservados(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_reserva(uuid, boolean) TO anon, authenticated;