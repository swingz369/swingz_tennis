'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  Settings,
  Plus,
  Edit,
  Save,
  XCircle,
  CheckCircle,
  AlertCircle,
  Download,
  TestTube,
  Star,
  DollarSign,
  Shield,
  Globe,
  Lock,
  Zap,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PaymentSettings {
  id: string;
  gateway: 'stripe' | 'paypal' | 'sepa' | 'cash' | 'other';
  gatewayName: string;
  isActive: boolean;
  isDefault: boolean;
  config: {
    apiKey?: string;
    publicKey?: string;
    secretKey?: string;
    merchantId?: string;
    webhookUrl?: string;
    [key: string]: any;
  };
  supportedCurrencies: string[];
  supportedMethods: string[];
  minAmount?: number;
  maxAmount?: number;
  fees?: {
    fixed?: number;
    percentage?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function PaymentSettingsManagement() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PaymentSettings>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const loadPaymentSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/payment-settings');
      if (!response.ok) {
        throw new Error('Failed to load payment settings');
      }
      const data = await response.json();
      setPaymentSettings(data.paymentSettings || []);
    } catch (error) {
      console.error('Failed to load payment settings:', error);
      toast.error('Fehler beim Laden der Zahlungseinstellungen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      const response = await fetch('/api/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment settings');
      }

      const data = await response.json();
      setPaymentSettings([...paymentSettings, data.paymentSettings]);
      setEditForm({});
      toast.success('Zahlungseinstellungen erfolgreich erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen der Zahlungseinstellungen');
      console.error('Create error:', error);
    }
  };

  const handleUpdatePayment = async (id: string) => {
    try {
      const response = await fetch(`/api/payment-settings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment settings');
      }

      const data = await response.json();
      setPaymentSettings(paymentSettings.map((p) => (p.id === id ? data.paymentSettings : p)));
      setEditForm({});
      setIsEditing(false);
      toast.success('Zahlungseinstellungen erfolgreich aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Zahlungseinstellungen');
      console.error('Update error:', error);
    }
  };

  const handleSetAsDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/payment-settings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to set as default');
      }

      const data = await response.json();
      setPaymentSettings(paymentSettings.map((p) => (p.id === id ? data.paymentSettings : p)));
      toast.success('Als Standard-Zahlungsmethode festgelegt');
    } catch (error) {
      toast.error('Fehler beim Festlegen als Standard');
      console.error('Set as default error:', error);
    }
  };

  const handleTestPayment = async (id: string) => {
    try {
      const response = await fetch(`/api/payment-settings/${id}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to test payment settings');
      }

      const data = await response.json();
      toast.success(data.message);
    } catch (error) {
      toast.error('Fehler beim Testen der Zahlungseinstellungen');
      console.error('Test error:', error);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Möchten Sie diese Zahlungseinstellungen wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/payment-settings/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment settings');
      }

      setPaymentSettings(paymentSettings.filter((p) => p.id !== id));
      toast.success('Zahlungseinstellungen erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen der Zahlungseinstellungen');
      console.error('Delete error:', error);
    }
  };

  const getGatewayIcon = (gateway: PaymentSettings['gateway']) => {
    switch (gateway) {
      case 'stripe':
        return <CreditCard className="h-5 w-5" />;
      case 'paypal':
        return <Globe className="h-5 w-5" />;
      case 'sepa':
        return <Lock className="h-5 w-5" />;
      case 'cash':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Zahlungseinstellungen</h1>
          <p className="text-gray-500">Verwaltung aller Zahlungsgateways und -methoden</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Create New Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Zahlungseinstellungen erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Zahlungsgateway</Label>
              <select
                value={editForm.gateway || ''}
                onChange={(e) => setEditForm({ ...editForm, gateway: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Bitte auswählen...</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="sepa">SEPA Lastschrift</option>
                <option value="cash">Barzahlung</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.gatewayName || ''}
                onChange={(e) => setEditForm({ ...editForm, gatewayName: e.target.value })}
                placeholder="z.B. Stripe"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={editForm.config?.apiKey || ''}
                onChange={(e) => setEditForm({ ...editForm, config: { ...editForm.config, apiKey: e.target.value } })}
                placeholder="sk_test_..."
              />
            </div>
            <div>
              <Label>Public Key</Label>
              <Input
                value={editForm.config?.publicKey || ''}
                onChange={(e) => setEditForm({ ...editForm, config: { ...editForm.config, publicKey: e.target.value } })}
                placeholder="pk_test_..."
              />
            </div>
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={editForm.config?.webhookUrl || ''}
                onChange={(e) => setEditForm({ ...editForm, config: { ...editForm.config, webhookUrl: e.target.value } })}
                placeholder="https://swingz.app/api/webhooks/..."
              />
            </div>
            <div>
              <Label>Unterstützte Währungen</Label>
              <Input
                value={editForm.supportedCurrencies?.join(', ') || ''}
                onChange={(e) => setEditForm({ ...editForm, supportedCurrencies: e.target.value.split(',').map(s => s.trim()) })}
                placeholder="EUR, USD"
              />
            </div>
            <div>
              <Label>Unterstützte Methoden</Label>
              <Input
                value={editForm.supportedMethods?.join(', ') || ''}
                onChange={(e) => setEditForm({ ...editForm, supportedMethods: e.target.value.split(',').map(s => s.trim()) })}
                placeholder="card, sepa_debit"
              />
            </div>
            <div>
              <Label>Mindestbetrag (€)</Label>
              <Input
                type="number"
                value={editForm.minAmount || ''}
                onChange={(e) => setEditForm({ ...editForm, minAmount: parseFloat(e.target.value) })}
                placeholder="1.00"
              />
            </div>
            <div>
              <Label>Höchstbetrag (€)</Label>
              <Input
                type="number"
                value={editForm.maxAmount || ''}
                onChange={(e) => setEditForm({ ...editForm, maxAmount: parseFloat(e.target.value) })}
                placeholder="10000.00"
              />
            </div>
            <div>
              <Label>Feste Gebühr (€)</Label>
              <Input
                type="number"
                value={editForm.fees?.fixed || ''}
                onChange={(e) => setEditForm({ ...editForm, fees: { ...editForm.fees, fixed: parseFloat(e.target.value) } })}
                placeholder="0.30"
              />
            </div>
            <div>
              <Label>Prozentuale Gebühr (%)</Label>
              <Input
                type="number"
                value={editForm.fees?.percentage || ''}
                onChange={(e) => setEditForm({ ...editForm, fees: { ...editForm.fees, percentage: parseFloat(e.target.value) } })}
                placeholder="2.9"
              />
            </div>
          </div>
          <Button onClick={handleCreatePayment} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Zahlungseinstellungen erstellen
          </Button>
        </CardContent>
      </Card>

      {/* Payment Settings List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Zahlungseinstellungen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentSettings.map((payment) => (
            <Card key={payment.id} className={!payment.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 rounded-lg">
                      {getGatewayIcon(payment.gateway)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{payment.gatewayName}</CardTitle>
                      <p className="text-sm text-gray-600">{payment.gateway}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {payment.isDefault && (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" />
                        Standard
                      </Badge>
                    )}
                    {!payment.isActive && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-700">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Währungen:</span>
                      <span className="font-medium">{payment.supportedCurrencies.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Methoden:</span>
                      <span className="font-medium">{payment.supportedMethods.join(', ')}</span>
                    </div>
                  </div>

                  {payment.minAmount !== undefined && (
                    <div className="text-sm text-gray-600">
                      Min: €{payment.minAmount.toFixed(2)}
                    </div>
                  )}

                  {payment.maxAmount !== undefined && (
                    <div className="text-sm text-gray-600">
                      Max: €{payment.maxAmount.toFixed(2)}
                    </div>
                  )}

                  {payment.fees && (
                    <div className="text-sm text-gray-600">
                      Gebühren: {payment.fees.fixed ? `€${payment.fees.fixed.toFixed(2)} fest` : ''}{' '}
                      {payment.fees.percentage ? `+ ${payment.fees.percentage.toFixed(2)}%` : ''}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditForm(payment);
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestPayment(payment.id)}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      Testen
                    </Button>
                    {!payment.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetAsDefault(payment.id)}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Standard
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeletePayment(payment.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
