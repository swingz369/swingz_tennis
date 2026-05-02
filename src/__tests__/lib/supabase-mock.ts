import { vi } from 'vitest';

const mockQueryBuilder = {
  select: vi.fn(function() { return mockQueryBuilder; }),
  eq: vi.fn(function() { return mockQueryBuilder; }),
  in: vi.fn(function() { return mockQueryBuilder; }),
  order: vi.fn(function() { return mockQueryBuilder; }),
  limit: vi.fn(function() { return mockQueryBuilder; }),
  single: vi.fn(),
  insert: vi.fn(function() { return mockQueryBuilder; }),
  update: vi.fn(function() { return mockQueryBuilder; }),
};

const mockSupabase = {
  from: vi.fn(() => mockQueryBuilder),
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

export { mockSupabase, mockQueryBuilder };
