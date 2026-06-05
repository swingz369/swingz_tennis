'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { User, Mail, Phone, MapPin, CheckCircle, Loader2, Sparkles, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  playing_level: string;
  previous_club?: string;
  motivation?: string;
  wants_trial_training: boolean;
  status: string;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
}

export default function AdminApprovals() {
  const [requests, setRequests] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await apiFetch('/api/admin/approvals');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      const res = await apiFetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved' }),
      });
      if (!res.ok) throw new Error('Genehmigung fehlgeschlagen');
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)));
      setSelectedId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) return;
    setProcessing(true);
    try {
      const res = await apiFetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected', rejectionReason }),
      });
      if (!res.ok) throw new Error('Ablehnung fehlgeschlagen');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'rejected', rejection_reason: rejectionReason } : r
        )
      );
      setSelectedId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Ausstehend</Badge>
        );
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Genehmigt</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Abgelehnt</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);
  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    all: requests.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Mitglieder-Genehmigungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.pending} ausstehende{counts.pending !== 1 ? '' : 's'} von {counts.all} Anträgen
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'pending'
              ? 'Ausstehend'
              : f === 'approved'
                ? 'Genehmigt'
                : f === 'rejected'
                  ? 'Abgelehnt'
                  : 'Alle'}
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            Keine Anträge in dieser Kategorie
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className={r.status === 'pending' ? 'border-yellow-200 bg-yellow-50/30' : ''}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">
                        {r.first_name} {r.last_name}
                      </span>
                      {statusBadge(r.status)}
                      {r.wants_trial_training && (
                        <Badge variant="outline" className="text-xs bg-brand-light/10">
                          <Sparkles className="h-3 w-3 mr-1" /> Probetraining
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> {r.email}
                      </div>
                      {r.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" /> {r.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" /> {r.playing_level}
                      </div>
                      {(r.street || r.city) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {[r.street, r.postal_code, r.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Eingereicht: {formatDate(r.created_at)}
                    </div>

                    {r.status === 'rejected' && r.rejection_reason && (
                      <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        Grund: {r.rejection_reason}
                      </p>
                    )}

                    {r.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-2">
                        {selectedId === r.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(r.id)}
                              disabled={processing}
                              className="gap-1"
                            >
                              {processing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              Genehmigen
                            </Button>
                            <div className="flex-1 flex items-center gap-2">
                              <Textarea
                                placeholder="Ablehnungsgrund..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="h-9 text-sm flex-1 min-w-0"
                                rows={1}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(r.id)}
                                disabled={processing || !rejectionReason.trim()}
                              >
                                Ablehnen
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedId(null);
                                setRejectionReason('');
                              }}
                            >
                              Abbrechen
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="default" onClick={() => setSelectedId(r.id)}>
                            Aktion wählen
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
