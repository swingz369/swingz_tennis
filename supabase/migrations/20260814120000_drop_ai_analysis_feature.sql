-- Modul „KI-Analyse (Saisonplanung)" entfernt.
--
-- Der Schlüssel schaltete zwei Dinge frei: die inzwischen gelöschte Route
-- api/seasons/planning/ai-analysis (Plan-Zusammenfassung per Sprachmodell) und den
-- `use_ai`-Pfad der Auto-Planung (lib/ai/schedule-generator-v2.ts), der Mitglieder-,
-- Trainer- und Verfügbarkeitsdaten an ein externes Modell geschickt hat. Beides ist
-- aus dem Code entfernt; die Saisonplanung läuft ausschließlich deterministisch.
--
-- Ohne dieses UPDATE bliebe der Schalter in Vereinseinstellungen → Module als
-- wirkungsloser Eintrag stehen.

UPDATE clubs
SET features = features - 'ai_analysis'
WHERE features ? 'ai_analysis';
