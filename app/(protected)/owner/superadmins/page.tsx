'use client';

import { useState } from 'react';
import { UserPlus, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

export default function OwnerSuperadminsPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/owner/invite-admin', {
        method: 'POST',
        body: JSON.stringify({ email, fullName: name, role: 'superadmin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler');
        return;
      }
      toast.success(`Einladung an ${email} verschickt`);
      setEmail('');
      setName('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Superadmins einladen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Superadmins verwalten eine Gruppe von Vereinen (Tennisschule-Chef).
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Superadmin per E-Mail einladen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="saName">Name</Label>
              <Input
                id="saName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Max Mustermann"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="saEmail">E-Mail *</Label>
              <Input
                id="saEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@tennisschule.de"
                className="mt-1.5"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Der Superadmin erhält eine Einladungsmail und kann danach Vereine über den
              Club-Switcher verwalten.
            </p>
            <Button type="submit" className="w-full gap-2" disabled={loading || !email}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Einladung senden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
