import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: 'app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'SwingZ API Documentation',
        version: '2.0.0',
        description: `
# SwingZ Tennis Club Management API

Complete REST API documentation for the SwingZ platform.

## Authentication

Most endpoints require authentication using Supabase Auth JWT tokens.
Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

- **Login**: 5 requests per 15 minutes
- **API**: 100 requests per minute (default)
- **Webhooks**: 10 requests per minute

## Roles & Permissions

- **Member**: Basic access to sessions, bookings, profile
- **Trainer**: Member access + session management, availability
- **Admin**: Trainer access + member management, club settings
- **Superadmin**: Full access to all clubs and system settings

## Multi-Tenancy

All data is scoped to clubs using Row Level Security (RLS).
Users can only access data for clubs they belong to (except superadmins).
        `,
        contact: {
          name: 'SwingZ Support',
          email: 'support@swingz.app',
        },
        license: {
          name: 'Proprietary',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development Server',
        },
        {
          url: 'https://swingz.vercel.app',
          description: 'Production Server',
        },
      ],
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and session management',
        },
        {
          name: 'Members',
          description: 'Member management operations',
        },
        {
          name: 'Sessions',
          description: 'Training session management',
        },
        {
          name: 'Bookings',
          description: 'Session booking operations',
        },
        {
          name: 'Clubs',
          description: 'Club management',
        },
        {
          name: 'Trainers',
          description: 'Trainer profile and availability management',
        },
        {
          name: 'Courts',
          description: 'Court management and reservations',
        },
        {
          name: 'Billing',
          description: 'Invoicing and payment operations',
        },
        {
          name: 'Analytics',
          description: 'Analytics and reporting',
        },
        {
          name: 'Admin',
          description: 'Administrative operations',
        },
        {
          name: 'System',
          description: 'System health and configuration',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Supabase JWT token',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'string',
                description: 'Error message',
              },
            },
            required: ['error'],
          },
          Success: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
            },
          },
          Member: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              email: {
                type: 'string',
                format: 'email',
              },
              name: {
                type: 'string',
              },
              club_id: {
                type: 'string',
                format: 'uuid',
              },
              is_active: {
                type: 'boolean',
              },
              role: {
                type: 'string',
                enum: ['member', 'trainer', 'admin', 'super_admin'],
              },
              created_at: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          Session: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              schedule_id: {
                type: 'string',
                format: 'uuid',
              },
              trainer_id: {
                type: 'string',
                format: 'uuid',
              },
              timeslot_start: {
                type: 'string',
                format: 'date-time',
              },
              timeslot_end: {
                type: 'string',
                format: 'date-time',
              },
              max_participants: {
                type: 'integer',
                minimum: 1,
              },
              notes: {
                type: 'string',
                nullable: true,
              },
            },
          },
          Booking: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              member_id: {
                type: 'string',
                format: 'uuid',
              },
              session_id: {
                type: 'string',
                format: 'uuid',
              },
              status: {
                type: 'string',
                enum: ['confirmed', 'cancelled', 'completed', 'no_show'],
              },
              booked_at: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          Club: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              name: {
                type: 'string',
              },
              address: {
                type: 'string',
              },
              contact_email: {
                type: 'string',
                format: 'email',
              },
              is_active: {
                type: 'boolean',
              },
            },
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });
  return spec;
};
