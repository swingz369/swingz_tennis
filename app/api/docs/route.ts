import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger/swagger-config';

export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
