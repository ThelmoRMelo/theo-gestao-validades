-- ═══ SISTEMA DE CHAT COMPLETO ═══

-- 1. Criar tabela de conversas
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('global', 'private')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Criar tabela de participantes
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 3. Adicionar novas colunas na tabela chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- 4. Habilitar RLS nas novas tabelas
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para chat_conversations
CREATE POLICY "Allow read chat_conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert chat_conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update chat_conversations" 
ON public.chat_conversations 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete chat_conversations" 
ON public.chat_conversations 
FOR DELETE 
USING (true);

-- 6. Políticas para chat_participants
CREATE POLICY "Allow read chat_participants" 
ON public.chat_participants 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert chat_participants" 
ON public.chat_participants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow delete chat_participants" 
ON public.chat_participants 
FOR DELETE 
USING (true);

-- 7. Atualizar políticas de chat_messages para permitir UPDATE (reações)
DROP POLICY IF EXISTS "Allow update chat_messages" ON public.chat_messages;
CREATE POLICY "Allow update chat_messages" 
ON public.chat_messages 
FOR UPDATE 
USING (true);

-- 8. Criar conversa global padrão
INSERT INTO public.chat_conversations (id, type) 
VALUES ('00000000-0000-0000-0000-000000000001', 'global')
ON CONFLICT (id) DO NOTHING;

-- 9. Atualizar mensagens existentes para pertencer à conversa global
UPDATE public.chat_messages 
SET conversation_id = '00000000-0000-0000-0000-000000000001' 
WHERE conversation_id IS NULL;

-- 10. Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- 11. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON public.chat_messages(deleted);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON public.chat_participants(conversation_id);