-- Migration: Nachrichten archivieren und löschen
--
-- Hintergrund: `messages` kannte bisher nur `is_read`. Eine Nachricht ließ sich
-- weder wegräumen noch entfernen — der Posteingang wuchs monoton, was das
-- Modul für Mitglieder und Trainer unbrauchbar machte.
--
-- Warum drei Spalten und nicht eine: Absender und Empfänger teilen sich
-- dieselbe Zeile (`/messages?folder=sent` liest über sender_id). Ein
-- gemeinsames `deleted_at` würde die Nachricht auch beim jeweils anderen
-- verschwinden lassen. Deshalb getrennte Sicht-Zustände:
--   archived_at        — Empfänger hat aus dem Posteingang ins Archiv gelegt
--   deleted_at         — Empfänger hat gelöscht (soft, für Nachforschungen)
--   sender_deleted_at  — Absender hat aus „Gesendet" entfernt
--
-- Soft-Delete statt DELETE: Vereinskommunikation ist im Streitfall Beleg
-- (wer hat wann welche Absage bekommen). Zeilen bleiben, die Sicht ändert sich.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_deleted_at timestamptz;

COMMENT ON COLUMN public.messages.archived_at IS
  'Empfänger hat die Nachricht archiviert. Posteingang zeigt nur archived_at IS NULL.';
COMMENT ON COLUMN public.messages.deleted_at IS
  'Empfänger hat die Nachricht gelöscht (soft). Für den Empfänger überall unsichtbar.';
COMMENT ON COLUMN public.messages.sender_deleted_at IS
  'Absender hat die Nachricht aus dem Ordner „Gesendet" entfernt (soft).';

-- Posteingangs-Query: receiver_id + deleted_at IS NULL + archived_at IS NULL,
-- sortiert nach created_at. Der Teilindex hält den heißen Pfad schmal.
CREATE INDEX IF NOT EXISTS messages_inbox_idx
  ON public.messages (receiver_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_sent_idx
  ON public.messages (sender_id, created_at DESC)
  WHERE sender_deleted_at IS NULL;
