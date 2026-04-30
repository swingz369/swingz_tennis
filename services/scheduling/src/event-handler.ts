// services/scheduling/src/event-handler.ts
import Redis from 'ioredis';

export class MicroserviceEventHandler {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async listenToBillingEvents(): Promise<void> {
    const stream = this.redis.xread(
      'BLOCK',
      0,
      'STREAMS',
      'events:billing',
      '0'
    );

    stream.then((data) => {
      if (data && data[0]) {
        const [stream, messages] = data[0];
        messages.forEach(([id, fields]) => {
          const event = this.parseMessage(fields);
          this.handleBillingEvent(event);
        });
      }
    });
  }

  private parseMessage(fields: string[]): any {
    const obj: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }

  private async handleBillingEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'subscription.activated':
        await this.activatePremiumFeatures(event.userId, event.plan);
        break;
      case 'subscription.cancelled':
        await this.downgradeToFree(event.userId);
        break;
    }
  }

  private async activatePremiumFeatures(userId: string, plan: string): Promise<void> {
    console.log(`Activating ${plan} features for user ${userId}`);
    // Premium Feature Logic
  }

  private async downgradeToFree(userId: string): Promise<void> {
    console.log(`Downgrading user ${userId} to free plan`);
    // Downgrade Logic
  }
}
