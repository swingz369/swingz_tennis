'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface SEPAMandateFormData {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  mandateReference: string;
  signatureDate: string;
  acceptTerms: boolean;
  acceptDirectDebit: boolean;
}

const INITIAL_FORM_DATA: SEPAMandateFormData = {
  accountHolder: '',
  iban: '',
  bic: '',
  bankName: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  mandateReference: '',
  signatureDate: new Date().toISOString().split('T')[0],
  acceptTerms: false,
  acceptDirectDebit: false,
};

export default function SEPAMandateSigning() {
  const [formData, setFormData] = useState<SEPAMandateFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateIBAN = (iban: string): boolean => {
    const cleanedIBAN = iban.replace(/\s/g, '').toUpperCase();
    if (cleanedIBAN.length < 15 || cleanedIBAN.length > 34) {
      return false;
    }
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
    return ibanRegex.test(cleanedIBAN);
  };

  const validateBIC = (bic: string): boolean => {
    const cleanedBIC = bic.replace(/\s/g, '').toUpperCase();
    const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    return bicRegex.test(cleanedBIC);
  };

  const formatIBAN = (value: string): string => {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'iban') {
      formattedValue = formatIBAN(value);
    } else if (name === 'bic') {
      formattedValue = value.replace(/\s/g, '').toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.accountHolder.trim()) {
      newErrors.accountHolder = 'Kontoinhaber ist erforderlich';
    }

    if (!formData.iban.trim()) {
      newErrors.iban = 'IBAN ist erforderlich';
    } else if (!validateIBAN(formData.iban)) {
      newErrors.iban = 'Ungültige IBAN';
    }

    if (!formData.bic.trim()) {
      newErrors.bic = 'BIC ist erforderlich';
    } else if (!validateBIC(formData.bic)) {
      newErrors.bic = 'Ungültige BIC';
    }

    if (!formData.bankName.trim()) {
      newErrors.bankName = 'Bankname ist erforderlich';
    }

    if (!formData.street.trim()) {
      newErrors.street = 'Straße ist erforderlich';
    }

    if (!formData.houseNumber.trim()) {
      newErrors.houseNumber = 'Hausnummer ist erforderlich';
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Postleitzahl ist erforderlich';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'Stadt ist erforderlich';
    }

    if (!formData.mandateReference.trim()) {
      newErrors.mandateReference = 'Mandatsreferenz ist erforderlich';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Du musst die Bedingungen akzeptieren';
    }

    if (!formData.acceptDirectDebit) {
      newErrors.acceptDirectDebit = 'Du musst der Lastschrift zustimmen';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Bitte fülle alle Pflichtfelder korrekt aus');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setIsSigned(true);
      toast.success('SEPA-Mandat erfolgreich unterzeichnet!');
    } catch (error) {
      toast.error('Fehler beim Speichern des SEPA-Mandats');
      console.error('SEPA mandate error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.info('PDF-Download wird vorbereitet...');
    // In production, this would generate and download a PDF
  };

  if (isSigned) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-900 mb-2">
                  SEPA-Mandat erfolgreich unterzeichnet
                </h2>
                <p className="text-green-700">
                  Dein SEPA-Lastschriftmandat wurde erfolgreich gespeichert.
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Kontoinhaber:</span>
                  <span className="font-medium">{formData.accountHolder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IBAN:</span>
                  <span className="font-medium">{formData.iban}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bank:</span>
                  <span className="font-medium">{formData.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mandatsreferenz:</span>
                  <span className="font-medium">{formData.mandateReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unterschriftdatum:</span>
                  <span className="font-medium">
                    {new Date(formData.signatureDate).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleDownloadPDF} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  PDF herunterladen
                </Button>
                <Button onClick={() => setIsSigned(false)}>
                  Neues Mandat erstellen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary mb-2">
          SEPA-Lastschriftmandat
        </h1>
        <p className="text-gray-600">
          Unterschreibe dein SEPA-Mandat für automatische Zahlungen
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Mit diesem Mandat autorisierst du SwingZ Tennis Club, Zahlungen von deinem Konto
          mittels SEPA-Lastschrift einzuziehen. Du kannst dieses Mandat jederzeit widerrufen.
        </AlertDescription>
      </Alert>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mandatsdaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Kontoinformationen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountHolder">Kontoinhaber *</Label>
                  <Input
                    id="accountHolder"
                    name="accountHolder"
                    value={formData.accountHolder}
                    onChange={handleChange}
                    placeholder="Max Mustermann"
                    className={errors.accountHolder ? 'border-red-500' : ''}
                  />
                  {errors.accountHolder && (
                    <p className="text-sm text-red-600">{errors.accountHolder}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN *</Label>
                  <Input
                    id="iban"
                    name="iban"
                    value={formData.iban}
                    onChange={handleChange}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    className={errors.iban ? 'border-red-500' : ''}
                  />
                  {errors.iban && (
                    <p className="text-sm text-red-600">{errors.iban}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bic">BIC *</Label>
                  <Input
                    id="bic"
                    name="bic"
                    value={formData.bic}
                    onChange={handleChange}
                    placeholder="COBADEFFXXX"
                    className={errors.bic ? 'border-red-500' : ''}
                  />
                  {errors.bic && (
                    <p className="text-sm text-red-600">{errors.bic}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">Bankname *</Label>
                  <Input
                    id="bankName"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder="Commerzbank"
                    className={errors.bankName ? 'border-red-500' : ''}
                  />
                  {errors.bankName && (
                    <p className="text-sm text-red-600">{errors.bankName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Adresse des Kontoinhabers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Straße *</Label>
                  <Input
                    id="street"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="Musterstraße"
                    className={errors.street ? 'border-red-500' : ''}
                  />
                  {errors.street && (
                    <p className="text-sm text-red-600">{errors.street}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="houseNumber">Hausnummer *</Label>
                  <Input
                    id="houseNumber"
                    name="houseNumber"
                    value={formData.houseNumber}
                    onChange={handleChange}
                    placeholder="123"
                    className={errors.houseNumber ? 'border-red-500' : ''}
                  />
                  {errors.houseNumber && (
                    <p className="text-sm text-red-600">{errors.houseNumber}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postleitzahl *</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="12345"
                    className={errors.postalCode ? 'border-red-500' : ''}
                  />
                  {errors.postalCode && (
                    <p className="text-sm text-red-600">{errors.postalCode}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Stadt *</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Musterstadt"
                    className={errors.city ? 'border-red-500' : ''}
                  />
                  {errors.city && (
                    <p className="text-sm text-red-600">{errors.city}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mandate Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Mandatsinformationen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mandateReference">Mandatsreferenz *</Label>
                  <Input
                    id="mandateReference"
                    name="mandateReference"
                    value={formData.mandateReference}
                    onChange={handleChange}
                    placeholder="SWINGZ-001234"
                    className={errors.mandateReference ? 'border-red-500' : ''}
                  />
                  {errors.mandateReference && (
                    <p className="text-sm text-red-600">{errors.mandateReference}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Wird automatisch generiert, wenn leer gelassen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signatureDate">Unterschriftdatum *</Label>
                  <Input
                    id="signatureDate"
                    name="signatureDate"
                    type="date"
                    value={formData.signatureDate}
                    onChange={handleChange}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => handleCheckboxChange('acceptTerms', checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="acceptTerms" className="cursor-pointer">
                    Ich akzeptiere die Bedingungen des SEPA-Lastschriftmandats *
                  </Label>
                  <p className="text-xs text-gray-600">
                    Ich ermächtige SwingZ Tennis Club, Zahlungen von meinem Konto mittels
                    SEPA-Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an,
                    die von SwingZ Tennis Club auf mein Konto gezogenen Lastschriften einzulösen.
                  </p>
                </div>
              </div>
              {errors.acceptTerms && (
                <p className="text-sm text-red-600">{errors.acceptTerms}</p>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptDirectDebit"
                  checked={formData.acceptDirectDebit}
                  onCheckedChange={(checked) => handleCheckboxChange('acceptDirectDebit', checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="acceptDirectDebit" className="cursor-pointer">
                    Ich stimme der Einziehung von Lastschriften zu *
                  </Label>
                  <p className="text-xs text-gray-600">
                    Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum,
                    die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem
                    Kreditinstitut vereinbarten Bedingungen.
                  </p>
                </div>
              </div>
              {errors.acceptDirectDebit && (
                <p className="text-sm text-red-600">{errors.acceptDirectDebit}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Wird gespeichert...' : 'Mandat unterzeichnen'}
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-medium">Wichtige Informationen</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Dieses Mandat gilt für alle Zahlungen an SwingZ Tennis Club</li>
                <li>Du kannst dieses Mandat jederzeit schriftlich widerrufen</li>
                <li>Die Gläubiger-Identifikationsnummer: DE98ZZZ00000000000</li>
                <li>Bei Fragen kontaktiere uns unter info@swingz.app</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}