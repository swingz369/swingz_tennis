export class Email {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email;
  }

  public static create(email: string): Email {
    const normalized = email.toLowerCase().trim();
    if (!this.isValid(normalized)) {
      throw new Error(`Invalid email format: ${email}`);
    }
    return new Email(normalized);
  }

  public static fromString(email: string): Email {
    return this.create(email);
  }

  public static isValid(email: string): boolean {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }
}
