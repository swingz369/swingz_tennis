'use client';
import { KpiBand } from '@/components/ui/kpi-band';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { generatePaymentCsvTemplate } from '@/lib/csv/payment-import';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';

const log = createLogger('billing:payment-import-dialog');

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  invalid: Array<{ record: Record<string, unknown>; errors: string[] }>;
  errors: Array<{ record: Record<string, unknown>; error: string }>;
}

export default function PaymentImportDialog() {
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

      const response = await apiFetch('/api/billing/payments/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast.success(`Import abgeschlossen: ${data.imported} Zahlungen importiert`);
      } else {
        toast.error(`Fehler: ${extractErrorMessage(data) || 'Import fehlgeschlagen'}`);
      }
    } catch (err) {
      log.error('Failed to import payments:', err);
      toast.error('Fehler beim Import der Zahlungen');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generatePaymentCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'zahlungen-import-vorlage.csv';
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Zahlungen importieren
        </span>
      </Button>
      <CenteredModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        className="max-w-3xl"
        ariaLabel="Zahlungen aus CSV importieren"
      >
        <div className="space-y-1 mb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Zahlungen aus CSV importieren
          </h2>
          <p className="text-sm text-muted-foreground">
            Importieren Sie Zahlungen aus einer CSV-Datei
          </p>
        </div>

        <div className="space-y-6 py-4">
          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Anleitung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Laden Sie die Vorlage herunter und füllen Sie sie aus</p>
              <p>2. Stellen Sie sicher, dass alle Pflichtfelder ausgefüllt sind</p>
              <p>3. Speichern Sie die Datei als CSV</p>
              <p>4. Laden Sie die Datei hier hoch</p>
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
              id="payment-csv-upload"
            />
            <label htmlFor="payment-csv-upload">
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Klicken Sie, um eine CSV-Datei auszuwählen
                </p>
                <p className="text-xs text-muted-foreground">Nur CSV-Dateien werden akzeptiert</p>
              </div>
            </label>
          </div>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import-Ergebnis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Summary */}
                  <KpiBand
                    items={[
                      { label: 'Erfolgreich', value: result.imported },
                      {
                        label: 'Fehlgeschlagen',
                        value: result.failed,
                        sub: result.failed ? 'Bitte prüfen' : undefined,
                        tone: 'down',
                      },
                      { label: 'Ungültig', value: result.invalid.length },
                    ]}
                  />

                  {/* Invalid Records */}
                  {result.invalid.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-warning-600" />
                        Ungültige Datensätze ({result.invalid.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.invalid.map((item, index) => (
                          <div key={index} className="text-xs bg-warning-50 p-2 rounded">
                            <div className="font-medium">
                              {String(
                                item.record.memberEmail ?? item.record.memberId ?? 'Unbekannt'
                              )}
                            </div>
                            <div className="text-muted-foreground">{item.errors.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failed Records */}
                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-error-600" />
                        Fehlgeschlagene Importe ({result.errors.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.errors.map((item, index) => (
                          <div key={index} className="text-xs bg-error-50 p-2 rounded">
                            <div className="font-medium">
                              {String(
                                item.record.memberEmail ?? item.record.memberId ?? 'Unbekannt'
                              )}
                            </div>
                            <div className="text-muted-foreground">{item.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {result.imported > 0 && result.failed === 0 && result.invalid.length === 0 && (
                    <div className="flex items-center justify-center text-success-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span className="font-medium">Alle Zahlungen erfolgreich importiert!</span>
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
