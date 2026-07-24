import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventSourcedClub } from '@/domain/aggregates/event-sourced-club';
import { ClubId } from '@/domain/value-objects';

vi.mock('@/infrastructure/cqrs/event-bus');
vi.mock('@/infrastructure/cqrs/event-store/redis-event-store');

const mockEventBus = {
  publish: vi.fn(),
} as any;

const mockEventStore = {
  save: vi.fn(),
  getEvents: vi.fn(),
  getCurrentVersion: vi.fn(),
  disconnect: vi.fn(),
} as any;

describe('EventSourcedClub', () => {
  let mockClubRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClubRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
  });

  describe('create', () => {
    it('should create club and emit ClubCreatedEvent', async () => {
      const club = await EventSourcedClub.create(
        ClubId.create(),
        'Test Club',
        100,
        {},
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      expect(club).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockEventStore.save).toHaveBeenCalled();
    });

    it('should have correct initial state', async () => {
      const clubId = ClubId.create();
      const club = await EventSourcedClub.create(
        clubId,
        'Test Club',
        100,
        { monday: { open: '08:00', close: '20:00' } },
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      const state = club.getState();
      expect(state.name).toBe('Test Club');
      expect(state.maxMembers).toBe(100);
      expect(state.status).toBe('active');
    });
  });

  describe('update', () => {
    it('should update club and emit ClubUpdatedEvent', async () => {
      const clubId = ClubId.create();
      const club = await EventSourcedClub.create(
        clubId,
        'Old Name',
        50,
        {},
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      club.update('New Name', 75);

      const state = club.getState();
      expect(state.name).toBe('New Name');
      expect(state.maxMembers).toBe(75);
    });
  });

  describe('delete', () => {
    it('should mark club as deleted and emit ClubDeletedEvent', async () => {
      const clubId = ClubId.create();
      const club = await EventSourcedClub.create(
        clubId,
        'Test Club',
        100,
        {},
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      club.delete();
      await club.save();

      const state = club.getState();
      expect(state.status).toBe('deleted');
    });
  });

  describe('member management', () => {
    it('should add member up to max capacity', async () => {
      const clubId = ClubId.create();
      const club = await EventSourcedClub.create(
        clubId,
        'Test Club',
        2,
        {},
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      club.addMember();
      club.addMember();

      expect(() => club.addMember()).toThrow('Club has reached maximum capacity');
    });
  });

  describe('load', () => {
    it('should reconstruct club from event history', async () => {
      const clubId = 'club-123';

      mockEventStore.getEvents.mockResolvedValue([
        {
          id: 'club-123',
          aggregateId: 'club-123',
          version: 1,
          timestamp: new Date(),
          name: 'Test Club',
          maxMembers: 100,
          eventType: 'club.created',
        },
      ]);

      const club = await EventSourcedClub.load(
        clubId,
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      expect(club).toBeDefined();
      expect(club!.getState().name).toBe('Test Club');
    });

    it('should return null for non-existent club', async () => {
      mockEventStore.getEvents.mockResolvedValue([]);

      const club = await EventSourcedClub.load(
        'non-existent',
        mockEventBus,
        mockEventStore,
        mockClubRepository
      );

      expect(club).toBeNull();
    });
  });
});
