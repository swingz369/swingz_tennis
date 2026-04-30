import { v4 as uuidv4 } from 'uuid';

export abstract class ValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  public getValue(): T {
    return this.value;
  }

  public equals(vo: ValueObject<T>): boolean {
    return this.value === vo.value;
  }

  public toString(): string {
    return String(this.value);
  }
}

export class Id extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): Id {
    return new Id(uuidv4());
  }

  public static fromString(id: string): Id {
    if (!id) {
      throw new Error('Id cannot be empty');
    }
    return new Id(id);
  }
}

export class TrainerId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): TrainerId {
    return new TrainerId(uuidv4());
  }

  public static fromString(id: string): TrainerId {
    if (!id) {
      throw new Error('TrainerId cannot be empty');
    }
    return new TrainerId(id);
  }
}

export class MemberId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): MemberId {
    return new MemberId(uuidv4());
  }

  public static fromString(id: string): MemberId {
    if (!id) {
      throw new Error('MemberId cannot be empty');
    }
    return new MemberId(id);
  }
}

export class ClubId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): ClubId {
    return new ClubId(uuidv4());
  }

  public static fromString(id: string): ClubId {
    if (!id) {
      throw new Error('ClubId cannot be empty');
    }
    return new ClubId(id);
  }
}

export class ScheduleId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): ScheduleId {
    return new ScheduleId(uuidv4());
  }

  public static fromString(id: string): ScheduleId {
    if (!id) {
      throw new Error('ScheduleId cannot be empty');
    }
    return new ScheduleId(id);
  }
}

export class BookingId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): BookingId {
    return new BookingId(uuidv4());
  }

  public static fromString(id: string): BookingId {
    if (!id) {
      throw new Error('BookingId cannot be empty');
    }
    return new BookingId(id);
  }
}

export class SessionId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  public static create(): SessionId {
    return new SessionId(uuidv4());
  }

  public static fromString(id: string): SessionId {
    if (!id) {
      throw new Error('SessionId cannot be empty');
    }
    return new SessionId(id);
  }
}
