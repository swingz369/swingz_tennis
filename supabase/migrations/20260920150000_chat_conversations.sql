-- Chat: Unterhaltungen (1:1 und Gruppe) statt E-Mail-artiger Einzelnachrichten.
-- Ersetzt public.messages (eine Zeile je Empfänger, Cross-Club-Insert möglich,
-- Empfänger konnte fremden Inhalt überschreiben). Entwicklungsphase, keine Live-Daten.
-- Auslieferung per Supabase Broadcast (Topic chat:<user_id>), nicht Postgres Changes.

DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('direct', 'group')),
  title text CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 120),
  direct_key text UNIQUE,
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_group_title CHECK (kind <> 'group' OR title IS NOT NULL),
  CONSTRAINT conversations_direct_key CHECK ((kind = 'direct') = (direct_key IS NOT NULL))
);
CREATE INDEX conversations_club_idx ON public.conversations (club_id, last_message_at DESC);

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON public.conversation_participants (user_id);

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  reply_to_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_messages_body CHECK (deleted_at IS NOT NULL OR char_length(body) BETWEEN 1 AND 5000)
);
CREATE INDEX conversation_messages_conv_idx ON public.conversation_messages (conversation_id, created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conv uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = p_conv AND user_id = auth.uid()
  )
$$;

-- Anlegen von Unterhaltungen nur über die RPCs unten (prüfen Vereinszugehörigkeit).
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT USING (public.is_conversation_participant(id));

CREATE POLICY conversation_participants_select ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_participant(conversation_id));
CREATE POLICY conversation_participants_update_own ON public.conversation_participants
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY conversation_participants_delete_own ON public.conversation_participants
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY conversation_messages_select ON public.conversation_messages
  FOR SELECT USING (public.is_conversation_participant(conversation_id));
CREATE POLICY conversation_messages_insert ON public.conversation_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));
CREATE POLICY conversation_messages_update_own ON public.conversation_messages
  FOR UPDATE USING (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id))
  WITH CHECK (sender_id = auth.uid());

-- Spaltenrechte: Eigene Lesemarke/Stummschaltung; Absender darf nur Text und Löschmarke ändern.
REVOKE UPDATE ON public.conversation_participants FROM authenticated, anon;
GRANT UPDATE (last_read_at, muted) ON public.conversation_participants TO authenticated;
REVOKE UPDATE ON public.conversation_messages FROM authenticated, anon;
GRANT UPDATE (body, edited_at, deleted_at) ON public.conversation_messages TO authenticated;

-- ── RPCs ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_direct_conversation(p_club_id uuid, p_other uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  v_key text;
  v_id uuid;
BEGIN
  IF me IS NULL OR p_other IS NULL OR p_other = me THEN
    RAISE EXCEPTION 'Ungültige Anfrage' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT user_id) FROM user_club_memberships
      WHERE club_id = p_club_id AND is_active AND user_id IN (me, p_other)) < 2 THEN
    RAISE EXCEPTION 'Kein Mitglied dieses Vereins' USING ERRCODE = '42501';
  END IF;

  v_key := p_club_id || ':' || least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  SELECT id INTO v_id FROM conversations WHERE direct_key = v_key;
  IF v_id IS NULL THEN
    INSERT INTO conversations (club_id, kind, direct_key, created_by)
    VALUES (p_club_id, 'direct', v_key, me)
    ON CONFLICT (direct_key) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM conversations WHERE direct_key = v_key;
    ELSE
      INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_id, me), (v_id, p_other);
    END IF;
  END IF;
  RETURN v_id;
END $$;

-- p_audience: 'custom' (p_user_ids), 'all' (alle aktiven Mitglieder), 'trainers' (Trainer + Verwaltung).
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_club_id uuid, p_title text, p_audience text DEFAULT 'custom', p_user_ids uuid[] DEFAULT '{}'
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  v_id uuid;
  v_ids uuid[];
BEGIN
  IF me IS NULL OR p_title IS NULL OR btrim(p_title) = '' OR p_audience NOT IN ('custom', 'all', 'trainers') THEN
    RAISE EXCEPTION 'Ungültige Anfrage' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_club_memberships
                 WHERE user_id = me AND club_id = p_club_id AND is_active
                   AND role IN ('trainer', 'admin', 'superadmin')) THEN
    RAISE EXCEPTION 'Nur Trainer und Verwaltung dürfen Gruppen anlegen' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(DISTINCT user_id), '{}') INTO v_ids
  FROM user_club_memberships
  WHERE club_id = p_club_id AND is_active
    AND CASE p_audience
          WHEN 'all' THEN true
          WHEN 'trainers' THEN role IN ('trainer', 'admin', 'superadmin')
          ELSE user_id = ANY (p_user_ids)
        END;
  v_ids := array_append(array_remove(v_ids, me), me);
  IF array_length(v_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Keine Empfänger gefunden' USING ERRCODE = '22023';
  END IF;
  IF array_length(v_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Maximal 500 Teilnehmer' USING ERRCODE = '22023';
  END IF;

  INSERT INTO conversations (club_id, kind, title, created_by)
  VALUES (p_club_id, 'group', btrim(p_title), me) RETURNING id INTO v_id;
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT v_id, unnest(v_ids);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.list_my_conversations(p_club_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, club_id uuid, kind text, title text, last_message_at timestamptz,
  last_message_preview text, unread_count bigint, muted boolean, last_read_at timestamptz,
  participant_count bigint, participants jsonb
)
  LANGUAGE sql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
  SELECT c.id, c.club_id, c.kind, c.title, c.last_message_at, c.last_message_preview,
    (SELECT count(*) FROM conversation_messages m
       WHERE m.conversation_id = c.id AND m.created_at > me.last_read_at
         AND m.sender_id <> auth.uid() AND m.deleted_at IS NULL),
    me.muted, me.last_read_at,
    (SELECT count(*) FROM conversation_participants p WHERE p.conversation_id = c.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.name)), '[]'::jsonb)
       FROM (SELECT p.user_id, coalesce(nullif(u.full_name, ''), u.email) AS name
               FROM conversation_participants p JOIN users u ON u.id = p.user_id
              WHERE p.conversation_id = c.id ORDER BY (p.user_id = auth.uid()), name LIMIT 50) x)
  FROM conversations c
  JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = auth.uid()
  WHERE p_club_id IS NULL OR c.club_id = p_club_id
  ORDER BY c.last_message_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.chat_unread_total() RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
  SELECT count(*)::int
  FROM conversation_participants p
  JOIN conversation_messages m ON m.conversation_id = p.conversation_id
  WHERE p.user_id = auth.uid() AND NOT p.muted AND m.created_at > p.last_read_at
    AND m.sender_id <> auth.uid() AND m.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.start_direct_conversation(uuid, uuid), public.create_group_conversation(uuid, text, text, uuid[]),
  public.list_my_conversations(uuid), public.chat_unread_total() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation(uuid, uuid), public.create_group_conversation(uuid, text, text, uuid[]),
  public.list_my_conversations(uuid), public.chat_unread_total() TO authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────
-- Ein privater Kanal je Nutzer (chat:<user_id>) trägt alle seine Unterhaltungen.

CREATE OR REPLACE FUNCTION public.chat_after_message() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversations
       SET last_message_at = NEW.created_at, last_message_preview = left(NEW.body, 120)
     WHERE id = NEW.conversation_id;
  END IF;
  FOR r IN SELECT user_id FROM conversation_participants WHERE conversation_id = NEW.conversation_id LOOP
    PERFORM realtime.send(
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message', to_jsonb(NEW)),
      CASE TG_OP WHEN 'INSERT' THEN 'message' ELSE 'message_updated' END,
      'chat:' || r.user_id, true);
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER chat_after_message AFTER INSERT OR UPDATE ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_after_message();

DROP POLICY IF EXISTS chat_broadcast_receive ON realtime.messages;
CREATE POLICY chat_broadcast_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.messages.extension = 'broadcast' AND realtime.topic() = 'chat:' || auth.uid()::text);
