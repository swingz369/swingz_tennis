import { NextRequest, NextResponse } from 'next/server';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { Club as ClubEntity } from '@/domain/entities/club';
import { ValidationService } from '@/domain/services/validation.service';
import { createClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const clubRepo = new DrizzleClubRepository();

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const clubs = await clubRepo.findAll();
      return NextResponse.json(
        clubs.map((c) => ({
          id: c.getId().getValue(),
          name: c.getName(),
          status: c.getStatus(),
          memberCount: c.getMemberCount(),
          maxMembers: c.getMaxMembers(),
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error listing clubs:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'superadmin');
    if (!hasRole) {
      return forbiddenResponse('Superadmin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    return withValidation(createClubSchema, async (input) => {
      try {
        ValidationService.validateClubCreation(input.name, input.maxMembers, input.openingHours);

        const club = ClubEntity.create(input.name, input.maxMembers, input.openingHours);
        await clubRepo.save(club);

        await AuditService.logClubCreated(auth.user.id, club.getId().getValue(), input.name);

        return NextResponse.json(
          {
            clubId: club.getId().getValue(),
            name: club.getName(),
          },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating club:', error);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    })(req);
  });
}
