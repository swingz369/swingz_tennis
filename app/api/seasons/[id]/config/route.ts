// PUT /api/seasons/[id]/config — Alias auf PUT /api/seasons/[id]/planning/config
// (gleiche Felder, gleiche Regeln; die Planungs-Route kennt zusätzlich unassigned_rate_threshold).
export { PUT } from '../planning/config/route';
