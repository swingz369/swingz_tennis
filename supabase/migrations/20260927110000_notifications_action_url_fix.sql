-- Benachrichtigungs-Links, die ins Leere oder in den falschen Rollenbereich führten.
-- Platzsperre/Heimspiel gingen an alle Vereinsmitglieder mit festem '/member' —
-- Admins und Trainer landeten im Mitgliederbereich. /dashboard leitet je nach Rolle weiter.
update public.notifications set action_url = '/dashboard' where action_url = '/member';

-- Fehlzeiten-Hinweise speicherten die nackte memberId als Link (relativer Pfad, 404).
update public.notifications
set action_url = '/trainer?absent=' || action_url
where type = 'absence_alert' and action_url not like '/%';
