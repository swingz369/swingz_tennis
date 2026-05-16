'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { generatePaymentCsvTemplate } from '@/lib/csv/payment-import';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  invalid: Array<{ record: any; errors: string[] }>;
  errors: Array<{ record: any; error: string }>;
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

      const response = await fetch('/api/billing/payments/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast.success(`Import abgeschlossen: ${data.imported} Zahlungen importiert`);
      } else {
        toast.error(`Fehler: ${data.error || 'Import fehlgeschlagen'}`);
      }
    } catch (err) {
      console.error('Failed to import payments:', err);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <span className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Zahlungen importieren
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zahlungen aus CSV importieren</DialogTitle>
          <DialogDescription>Importieren Sie Zahlungen aus einer CSV-Datei</DialogDescription>
        </DialogHeader>

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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Klicken Sie, um eine CSV-Datei auszuwählen
                </p>
                <p className="text-xs text-gray-500">Nur CSV-Dateien werden akzeptiert</p>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                      <div className="text-sm text-gray-600">Erfolgreich</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                      <div className="text-sm text-gray-600">Fehlgeschlagen</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {result.invalid.length}
                      </div>
                      <div className="text-sm text-gray-600">Ungültig</div>
                    </div>
                  </div>

                  {/* Invalid Records */}
                  {result.invalid.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
                        Ungültige Datensätze ({result.invalid.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.invalid.map((item, index) => (
                          <div key={index} className="text-xs bg-yellow-50 p-2 rounded">
                            <div className="font-medium">
                              {item.record.memberEmail || item.record.memberId || 'Unbekannt'}
                            </div>
                            <div className="text-gray-600">{item.errors.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failed Records */}
                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                        Fehlgeschlagene Importe ({result.errors.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {result.errors.map((item, index) => (
                          <div key={index} className="text-xs bg-red-50 p-2 rounded">
                            <div className="font-medium">
                              {item.record.memberEmail || item.record.memberId || 'Unbekannt'}
                            </div>
                            <div className="text-gray-600">{item.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {result.imported > 0 && result.failed === 0 && result.invalid.length === 0 && (
                    <div className="flex items-center justify-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span className="font-medium">Alle Zahlungen erfolgreich importiert!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={loading}>
            {loading ? 'Wird importiert...' : 'Schließen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
