CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: lot_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lot_status AS ENUM (
    'active',
    'disabled'
);


--
-- Name: check_user_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_role(_local_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.app_users au ON ur.user_id = au.id
    WHERE au.local_user_id = _local_user_id
      AND ur.role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: app_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_identity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icon_url text,
    title text DEFAULT 'Sistema de controle de validades'::text,
    subtitle text DEFAULT 'Estoque Seguro'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.app_identity REPLICA IDENTITY FULL;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local_user_id uuid NOT NULL,
    device_id text NOT NULL,
    name text NOT NULL,
    function text NOT NULL,
    is_active boolean DEFAULT true,
    can_edit_others_lots boolean DEFAULT false,
    can_delete_lots boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    can_deactivate_products boolean DEFAULT false,
    can_manage_sectors boolean DEFAULT false
);

ALTER TABLE ONLY public.app_users REPLICA IDENTITY FULL;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_name text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.chat_messages REPLICA IDENTITY FULL;


--
-- Name: product_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barcode text NOT NULL,
    expiration_date date NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status public.lot_status DEFAULT 'active'::public.lot_status,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pending_sync boolean DEFAULT false
);

ALTER TABLE ONLY public.product_lots REPLICA IDENTITY FULL;


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    barcode text NOT NULL,
    name text NOT NULL,
    sector text DEFAULT 'Geral'::text NOT NULL,
    alert_days integer DEFAULT 60,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pending_sync boolean DEFAULT false,
    is_active boolean DEFAULT true,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);

ALTER TABLE ONLY public.produtos REPLICA IDENTITY FULL;


--
-- Name: sectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.sectors REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL
);


--
-- Name: app_identity app_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_identity
    ADD CONSTRAINT app_identity_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_local_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_local_user_id_key UNIQUE (local_user_id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: product_lots product_lots_barcode_expiration_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lots
    ADD CONSTRAINT product_lots_barcode_expiration_date_key UNIQUE (barcode, expiration_date);


--
-- Name: product_lots product_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lots
    ADD CONSTRAINT product_lots_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_barcode_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_barcode_unique UNIQUE (barcode);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: sectors sectors_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_name_key UNIQUE (name);


--
-- Name: sectors sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_app_users_local_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_users_local_id ON public.app_users USING btree (local_user_id);


--
-- Name: idx_product_lots_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_lots_barcode ON public.product_lots USING btree (barcode);


--
-- Name: idx_product_lots_expiration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_lots_expiration ON public.product_lots USING btree (expiration_date);


--
-- Name: idx_product_lots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_lots_status ON public.product_lots USING btree (status);


--
-- Name: idx_produtos_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_sector ON public.produtos USING btree (sector);


--
-- Name: app_users update_app_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_lots update_product_lots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_lots_updated_at BEFORE UPDATE ON public.product_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: produtos update_produtos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: product_lots product_lots_barcode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lots
    ADD CONSTRAINT product_lots_barcode_fkey FOREIGN KEY (barcode) REFERENCES public.produtos(barcode) ON DELETE CASCADE;


--
-- Name: product_lots product_lots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lots
    ADD CONSTRAINT product_lots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id);


--
-- Name: produtos produtos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: product_lots Allow delete product_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete product_lots" ON public.product_lots FOR DELETE USING (true);


--
-- Name: produtos Allow delete produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete produtos" ON public.produtos FOR DELETE USING (true);


--
-- Name: user_roles Allow delete user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete user_roles" ON public.user_roles FOR DELETE USING (true);


--
-- Name: app_identity Allow insert app_identity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert app_identity" ON public.app_identity FOR INSERT WITH CHECK (true);


--
-- Name: app_settings Allow insert app_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);


--
-- Name: app_users Allow insert app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert app_users" ON public.app_users FOR INSERT WITH CHECK (true);


--
-- Name: chat_messages Allow insert chat_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);


--
-- Name: product_lots Allow insert product_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert product_lots" ON public.product_lots FOR INSERT WITH CHECK (true);


--
-- Name: produtos Allow insert produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert produtos" ON public.produtos FOR INSERT WITH CHECK (true);


--
-- Name: sectors Allow insert sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert sectors" ON public.sectors FOR INSERT WITH CHECK (true);


--
-- Name: user_roles Allow insert user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert user_roles" ON public.user_roles FOR INSERT WITH CHECK (true);


--
-- Name: app_identity Allow read app_identity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read app_identity" ON public.app_identity FOR SELECT USING (true);


--
-- Name: app_settings Allow read app_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read app_settings" ON public.app_settings FOR SELECT USING (true);


--
-- Name: app_users Allow read app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read app_users" ON public.app_users FOR SELECT USING (true);


--
-- Name: chat_messages Allow read chat_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read chat_messages" ON public.chat_messages FOR SELECT USING (true);


--
-- Name: product_lots Allow read product_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read product_lots" ON public.product_lots FOR SELECT USING (true);


--
-- Name: produtos Allow read produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read produtos" ON public.produtos FOR SELECT USING (true);


--
-- Name: sectors Allow read sectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read sectors" ON public.sectors FOR SELECT USING (true);


--
-- Name: user_roles Allow read user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read user_roles" ON public.user_roles FOR SELECT USING (true);


--
-- Name: app_identity Allow update app_identity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update app_identity" ON public.app_identity FOR UPDATE USING (true);


--
-- Name: app_settings Allow update app_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update app_settings" ON public.app_settings FOR UPDATE USING (true);


--
-- Name: app_users Allow update app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update app_users" ON public.app_users FOR UPDATE USING (true);


--
-- Name: product_lots Allow update product_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update product_lots" ON public.product_lots FOR UPDATE USING (true);


--
-- Name: produtos Allow update produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update produtos" ON public.produtos FOR UPDATE USING (true);


--
-- Name: user_roles Allow update user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update user_roles" ON public.user_roles FOR UPDATE USING (true);


--
-- Name: app_identity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_identity ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: product_lots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: sectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;