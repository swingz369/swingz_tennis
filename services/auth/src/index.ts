// services/auth/src/index.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:8000',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-key'
);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const JWT_SECRET = process.env.JWT_SECRET || 'tsow-secret';

// Multi-Tenant JWT Generierung
interface AuthPayload {
  userId: string;
  tenantId: string; // Club ID als Tenant
  email: string;
  roles: string[];
}

// Login - Generiert Tenant-spezifisches JWT
app.post('/auth/login', async (req, res) => {
  const { email, password, tenantId } = req.body;

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Prüfe ob User zum Tenant gehört
  const { data: membership, error: memberError } = await supabase
    .from('user_club_memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('club_id', tenantId)
    .single();

  if (memberError || !membership) {
    return res.status(403).json({ error: 'User not member of this tenant' });
  }

  const payload: AuthPayload = {
    userId: user.id,
    tenantId: tenantId,
    email: user.email || '',
    roles: membership.role ? [membership.role] : ['member'],
  };

  // JWT mit Tenant-Isolation
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'tsow-auth-service',
  });

  // Session in Redis cachen
  await redis.setex(`session:${user.id}:${tenantId}`, 86400, token);

  res.json({ token, user: payload });
});

// Superadmin Login (über alle Tenants hinweg)
app.post('/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Prüfe ob Superadmin (über alle Clubs)
  const { data: memberships, error: memberError } = await supabase
    .from('user_club_memberships')
    .select('*')
    .eq('user_id', user.id);

  if (memberError) {
    return res.status(500).json({ error: 'Database error' });
  }

  const payload: AuthPayload = {
    userId: user.id,
    tenantId: '*', // Wildcard für Superadmin
    email: user.email || '',
    roles: ['superadmin', ...memberships.map((m) => m.role)],
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'tsow-auth-service',
  });

  res.json({ token, user: payload });
});

// Token Validierung Middleware
export const verifyToken = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Tenant Isolation Middleware
export const requireTenantAccess = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const user = (req as any).user;
  const requestedTenantId = req.params.tenantId || req.body.tenantId;

  if (user.roles.includes('superadmin')) {
    return next(); // Superadmin hat Zugriff auf alle Tenants
  }

  if (user.tenantId !== requestedTenantId) {
    return res.status(403).json({ error: 'Access denied to this tenant' });
  }

  next();
};

// Protected Route Example
app.get('/api/user/profile', verifyToken, async (req, res) => {
  const user = (req as any).user;
  res.json({ message: 'Profile data', user });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
