export interface SystemSettings {
  id: string;
  category: 'general' | 'email' | 'notifications' | 'security' | 'integrations' | 'other';
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  isPublic: boolean;
  isRequired: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
  updatedAt: string;
  updatedBy?: string;
}

export interface CreateSystemSettingsInput {
  category: 'general' | 'email' | 'notifications' | 'security' | 'integrations' | 'other';
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface UpdateSystemSettingsInput {
  value?: string;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}
