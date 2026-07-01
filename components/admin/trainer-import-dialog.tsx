'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { generateTrainerCsvTemplate } from '@/lib/csv/member-import';
import { apiFetch } from '@/lib/api-fetch';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  invalid: Array<{ record: { email: string; fullName: string }; errors: string[] }>;
  errors: Array<{ record: { email: string; fullName: string }; error: string }>;
}

interface TrainerImportDialogProps {
  onImportComplete?: () => void;
}

export default function TrainerImportDialog({ onImportComplete }: TrainerImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch('/api/members/bulk-import?defaultRole=trainer', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        const messages: string[] = [];
        if (data.imported > 0) messages.push(`${data.imported} importiert`);
        if (data.skipped > 0) messages.push(`${data.skipped} übersprungen`);
        if (data.failed > 0) messages.push(`${data.failed} fehlgeschlagen`);
        toast.success(`Import abgeschlossen: ${messages.join(', ')}`);
        if (data.imported > 0) {
          onImportComplete?.();
        }
      } else {
        toast.error(`Fehler: ${data.error || 'Import fehlgeschlagen'}`);
      }
    } catch (err) {
      console.error('Failed to import trainers:', err);
      toast.error('Fehler beim Import der Trainer');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateTrainerCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trainer-import-vorlage.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Upload className="h-4 w-4" />
        CSV Import
      </Button>
      <CenteredModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        className="max-w-3xl"
        ariaLabel="Trainer aus CSV importieren"
      >
        <div className="space-y-1 mb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Trainer aus CSV importieren
          </h2>
          <p className="text-sm text-muted-foreground">
            Importiere mehrere Trainer gleichzeitig aus einer CSV-Datei
          </p>
        </div>

        <div className="space-y-6 py-4">
          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Anleitung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Lade die Vorlage herunter und fülle sie aus</p>
              <p>
                2. Pflichtfelder: <strong>E-Mail</strong> und <strong>Name</strong>
              </p>
              <p>
                3. Optionale Felder: <strong>Telefon</strong>, <strong>Geburtsdatum</strong>,{' '}
                <strong>Straße</strong>, <strong>PLZ</strong>, <strong>Ort</strong>,{' '}
                <strong>Notizen</strong>
              </p>
              <p>
                4. Bestehende Nutzer werden automatisch erkannt — nur die Club-Membership wird
                erstellt
              </p>
              <p>5. Speichere die Datei als CSV und lade sie hier hoch</p>
            </CardContent>
          </Card>

          {/* Download Template */}
          <div className="flex justify-center">
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Vorlage herunterladen
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={loading}
              className="hidden"
              id="trainer-csv-upload"
            />
            <label htmlFor="trainer-csv-upload">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-brand-primary/50 transition-colors">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Klicke hier, um eine CSV-Datei auszuwählen
                </p>
                <p className="text-xs text-muted-foreground">Nur CSV-Dateien · Max. 500 Trainer</p>
              </div>
            </label>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                Trainer werden importiert...
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import-Ergebnis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success-600">{result.imported}</div>
                      <div className="text-xs text-muted-foreground">Importiert</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-info-600">{result.skipped}</div>
                      <div className="text-xs text-muted-foreground">Übersprungen</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-error-600">{result.failed}</div>
                      <div className="text-xs text-muted-foreground">Fehlgeschlagen</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {result.invalid.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Ungültig</div>
                    </div>
                  </div>

                  {/* Invalid Records */}
                  {result.invalid.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center text-sm">
                        <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
                        Ungültige Datensätze ({result.invalid.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.invalid.map((item, index) => (
                          <div
                            key={index}
                            className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded"
                          >
                            <div className="font-medium">{item.record.email || 'Unbekannt'}</div>
                            <div className="text-muted-foreground">{item.errors.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failed Records */}
                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center text-sm">
                        <AlertCircle className="h-4 w-4 mr-2 text-error-600" />
                        Fehlgeschlagene Importe ({result.errors.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.errors.map((item, index) => (
                          <div
                            key={index}
                            className="text-xs bg-error-50 dark:bg-error-900/20 p-2 rounded"
                          >
                            <div className="font-medium">{item.record.email || 'Unbekannt'}</div>
                            <div className="text-muted-foreground">{item.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skipped Info */}
                  {result.skipped > 0 && (
                    <div className="flex items-center text-sm text-info-600 dark:text-info-400">
                      <Users className="h-4 w-4 mr-2" />
                      {result.skipped} Trainer bereits im Verein — übersprungen
                    </div>
                  )}

                  {/* Success Message */}
                  {result.imported > 0 && result.failed === 0 && result.invalid.length === 0 && (
                    <div className="flex items-center justify-center text-success-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span className="font-medium">Alle Trainer erfolgreich importiert!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end pt-4 mt-4 border-t border-border">
          <Button onClick={handleClose} disabled={loading}>
            {loading ? 'Wird importiert...' : 'Schließen'}
          </Button>
        </div>
      </CenteredModal>
    </>
  );
}
