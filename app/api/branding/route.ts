[
  { 'next/server': 'import { z' },
  {
    clubId: 'z.string().uuid()',
    brand: 'z.object({\n    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6',
  },
  [
    '0-9',
    "A-Fa-f]{6}$/, 'Hex color required').default('#FF6B35'),\n    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required').default('#FFFFFF'), // Actually accent\n  }),\n  logos: z.object({\n    light: z.string().url().optional().nullable(),\n    dark: z.string().url().optional().nullable(),\n    favicon: z.string().url().optional().nullable(),\n  }),\n  customDomain: z.string().url().optional().nullable(),\n});\n\nexport async function GET(request: NextRequest) {\n  const { searchParams } = new URL(request.url);\n  const clubId = searchParams.get('clubId');\n\n  if (!clubId) {\n    return NextResponse.json({ error: 'clubId required' }, { status: 400 });\n  }\n\n  // Mock response - in real app fetch from database\n  return NextResponse.json({\n    clubId,\n    brand: {\n      primaryColor: '#1B4332',\n      secondaryColor: '#1e3a5f',\n      accentColor: '#FF6B35',\n    },\n    logos: { light: null, dark: null, favicon: null },\n    customDomain: null,\n  });\n}\n\nexport async function PUT(request: NextRequest) {\n  try {\n    const clubId = request.headers.get('x-club-id') || request.headers.get('x-tenant-id');\n    if (!clubId) {\n      return NextResponse.json({ error: 'Club ID header missing' }, { status: 400 });\n    }\n    const body = await request.json();\n    const validated = BrandingSchema.parse({ clubId, ...body });\n\n    // In real implementation: save to database\n    // await db.insert(brandingTable).values(validated);\n\n    return NextResponse.json({\n      success: true,\n      message: 'Branding updated',\n      data: validated,\n    });\n  } catch (err) {\n    return NextResponse.json(\n      { error: err instanceof Error ? err.message : 'Validation failed' },\n      { status: 400 }\n    );\n  }\n}",
  ],
];
