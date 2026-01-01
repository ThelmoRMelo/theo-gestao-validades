-- Adicionar chat_messages à publicação realtime para receber mensagens em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;