'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

type CheckItem = {
  key: string;
  label: string;
  count: number;
  required: number;
  status: 'ok' | 'error' | 'warn';
  hint: string;
  link?: string;
  linkLabel?: string;
};

interface ReadinessCheckProps {
  clubId: string;
  seasonId: string;
  onReady: (ready: boolean) => void;
}

export default function ScheduleReadinessCheck({ clubId, seasonId, onReady }: ReadinessCheckProps) {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!clubId) return;
    async function check() {
      const res = await apiFetch(`/api/clubs/${clubId}/planning-readiness?seasonId=${seasonId}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const {
        planningMembers: memberCount = 0,
        trainerCount: trainerCount = 0,
        availabilityCount: availCount = 0,
        courtCount: courtCount = 0,
        preferenceCount: prefCount = 0,
      } = data;

      const checks: CheckItem[] = [
        {
          key: 'planning_members',
          label: `${memberCount ?? 0} Mitglieder für Planung`,
          count: memberCount ?? 0,
          required: 1,
          status: (memberCount ?? 0) >= 1 ? 'ok' : 'error',
          hint: 'Aktiviere bei Mitgliedern die Option "Nimmt an Saisonplanung teil" im Mitglieder-Tab.',
          link: '/admin/members',
          linkLabel: 'Mitglieder verwalten',
        },
        {
          key: 'trainer_avail',
          label: `${availCount ?? 0} Trainer-Verfügbarkeiten`,
          count: availCount ?? 0,
          required: 1,
          status: (availCount ?? 0) >= 1 ? 'ok' : 'error',
          hint: `${trainerCount ?? 0} Trainer vorhanden — aber noch keine Verfügbarkeiten. Trainer unter Admin → Trainer eintragen.`,
          link: '/admin/trainers',
          linkLabel: 'Trainer verwalten',
        },
        {
          key: 'courts',
          label: `${courtCount ?? 0} Aktive Plätze`,
          count: courtCount ?? 0,
          required: 1,
          status: (courtCount ?? 0) >= 1 ? 'ok' : 'error',
          hint: 'Lege mindestens einen aktiven Platz an.',
          link: '/admin/courts',
          linkLabel: 'Plätze verwalten',
        },
        {
          key: 'preferences',
          label: `${prefCount ?? 0} Mitglieder-Präferenzen`,
          count: prefCount ?? 0,
          required: 0,
          status: (prefCount ?? 0) >= 1 ? 'ok' : 'warn',
          hint: 'Optional: Mitglieder können ihre Wunsch-Tage und -Zeiten eintragen. Ohne Präferenzen plant der Algorithmus trotzdem, aber weniger präzise.',
          link: '/member/preferences',
          linkLabel: 'Präferenzen ansehen',
        },
      ];

      setItems(checks);
      const allRequired = checks.filter((c) => c.required > 0).every((c) => c.status === 'ok');
      onReadyRef.current(allRequired);
      setLoading(false);
    }
    check();
  }, [clubId, seasonId]);

  if (loading || items.length === 0) return null;

  const errors = items.filter((c) => c.status === 'error');
  const warnings = items.filter((c) => c.status === 'warn');
  const allOk = errors.length === 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        allOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allOk ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <div>
            <p className={`text-sm font-semibold ${allOk ? 'text-green-800' : 'text-red-800'}`}>
              {allOk
                ? 'Bereit für Planung'
                : `${errors.length} Problem${errors.length > 1 ? 'e' : ''} muss${errors.length > 1 ? 'en' : ''} behoben werden`}
            </p>
            {!allOk && (
              <p className="text-xs text-red-600 mt-0.5">
                {errors.map((e) => e.label).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`text-xs font-medium ${allOk ? 'text-green-700' : 'text-red-700'}`}
        >
          {expanded ? 'Schließen' : 'Details'}
        </button>
      </div>

      {/* Chips Übersicht */}
      <div className="flex flex-wrap gap-2 mt-3">
        {items.map((item) => (
          <span
            key={item.key}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              item.status === 'ok'
                ? 'bg-green-100 text-green-700'
                : item.status === 'warn'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {item.status === 'ok' ? (
              <Check className="w-3 h-3" />
            ) : item.status === 'warn' ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {item.label}
          </span>
        ))}
      </div>

      {/* Details ausgeklappt */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {items
            .filter((c) => c.status !== 'ok')
            .map((item) => (
              <div
                key={item.key}
                className={`rounded-lg p-3 ${item.status === 'warn' ? 'bg-amber-50' : 'bg-red-50'}`}
              >
                <p
                  className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${
                    item.status === 'warn' ? 'text-amber-800' : 'text-red-800'
                  }`}
                >
                  {item.status === 'warn' ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {item.label}
                </p>
                <p className="text-xs leading-relaxed text-red-700">{item.hint}</p>
                {item.link && (
                  <a
                    href={item.link}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-red-700"
                  >
                    {item.linkLabel} <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          {allOk && (
            <p className="text-xs text-green-700">
              Alle Voraussetzungen erfüllt.{' '}
              {warnings.length > 0 &&
                `${warnings.length} optionale Empfehlung${warnings.length > 1 ? 'en' : ''}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
