-- Chat: Reaktionen auf Nachrichten (👍 🎾 ❤️ 😂 🙏). Eine Zeile je Person und Emoji.
-- Lesen/Setzen nur für Teilnehmer der Unterhaltung; löschen nur die eigene Reaktion.
-- Auslieferung wie Nachrichten per Broadcast auf chat:<user_id> (Event 'reaction').

CREATE TABLE IF NOT EXISTS public.conversation_message_reactions (
  message_id uuid NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  emoji text NOT NULL CHECK (emoji IN ('👍', '🎾', '❤️', '😂', '🙏')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.conversation_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_message_participant(p_message uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_messages m
      JOIN conversation_participants p ON p.conversation_id = m.conversation_id
     WHERE m.id = p_message AND p.user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.is_message_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_message_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS conversation_message_reactions_select ON public.conversation_message_reactions;
CREATE POLICY conversation_message_reactions_select ON public.conversation_message_reactions
  FOR SELECT USING (public.is_message_participant(message_id));

DROP POLICY IF EXISTS conversation_message_reactions_insert ON public.conversation_message_reactions;
CREATE POLICY conversation_message_reactions_insert ON public.conversation_message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_message_participant(message_id));

DROP POLICY IF EXISTS conversation_message_reactions_delete_own ON public.conversation_message_reactions;
CREATE POLICY conversation_message_reactions_delete_own ON public.conversation_message_reactions
  FOR DELETE USING (user_id = auth.uid());

REVOKE ALL ON public.conversation_message_reactions FROM anon;
REVOKE UPDATE ON public.conversation_message_reactions FROM authenticated;

CREATE OR REPLACE FUNCTION public.chat_after_reaction() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
DECLARE
  r record;
  v_row public.conversation_message_reactions%ROWTYPE;
  v_conv uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  SELECT conversation_id INTO v_conv FROM conversation_messages WHERE id = v_row.message_id;
  IF v_conv IS NULL THEN RETURN NULL; END IF;  -- Nachricht wird gerade mitgelöscht
  FOR r IN SELECT user_id FROM conversation_participants WHERE conversation_id = v_conv LOOP
    PERFORM realtime.send(
      jsonb_build_object('conversation_id', v_conv, 'message_id', v_row.message_id,
                         'user_id', v_row.user_id, 'emoji', v_row.emoji, 'removed', TG_OP = 'DELETE'),
      'reaction', 'chat:' || r.user_id, true);
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS chat_after_reaction ON public.conversation_message_reactions;
CREATE TRIGGER chat_after_reaction AFTER INSERT OR DELETE ON public.conversation_message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.chat_after_reaction();
