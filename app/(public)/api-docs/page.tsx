'use client';

import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  // Produktaudit 26.07.2026 (P4): interne API-Doku eingefroren — nur in Dev sichtbar.
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-screen bg-background">
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
