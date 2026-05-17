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
    [key: string]: string | undefined;
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

export interface CreatePaymentSettingsInput {
  gateway: 'stripe' | 'paypal' | 'sepa' | 'cash' | 'other';
  gatewayName: string;
  config: {
    apiKey?: string;
    publicKey?: string;
    secretKey?: string;
    merchantId?: string;
    webhookUrl?: string;
    [key: string]: string | undefined;
  };
  supportedCurrencies: string[];
  supportedMethods: string[];
  minAmount?: number;
  maxAmount?: number;
  fees?: {
    fixed?: number;
    percentage?: number;
  };
}

export interface UpdatePaymentSettingsInput {
  gatewayName?: string;
  isActive?: boolean;
  isDefault?: boolean;
  config?: {
    apiKey?: string;
    publicKey?: string;
    secretKey?: string;
    merchantId?: string;
    webhookUrl?: string;
    [key: string]: string | undefined;
  };
  supportedCurrencies?: string[];
  supportedMethods?: string[];
  minAmount?: number;
  maxAmount?: number;
  fees?: {
    fixed?: number;
    percentage?: number;
  };
}
