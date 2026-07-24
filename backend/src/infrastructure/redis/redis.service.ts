import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import buildRedisConnection from './redis.helper';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '#common/utils/error.utils';

@Injectable()
export class RedisService {
  private readonly redis: Redis | null;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;
  private subscriber: Redis | null = null;
  private memoryStore: Map<string, { value: string; expiry?: number }> =
    new Map();
  private lastErrorLogAt = 0;
  private readonly errorLogCooldownMs = 30000; // mute repeated errors for 30s

  constructor(private configService: ConfigService) {
    const shouldEnableRedis =
      process.env.ENABLE_REDIS === 'true' || Boolean(process.env.REDIS_URL);

    if (shouldEnableRedis) {
      const redisConn = buildRedisConnection(this.configService);
      if (typeof redisConn === 'string') {
        this.redis = new Redis(redisConn, { lazyConnect: true });
      } else {
        this.redis = new Redis({ ...redisConn, lazyConnect: true });
      }

      // Use 'ready' which indicates the client is fully ready to accept commands
      this.redis.on('ready', () => {
        const wasConnected = this.isConnected;
        this.isConnected = true;
        if (!wasConnected) {
          this.logger.log('Connected to Redis');
        } else {
          this.logger.debug('Redis ready event (already connected)');
        }
      });

      // 'close' is emitted when the connection has been closed
      this.redis.on('close', () => {
        if (this.isConnected) {
          this.logger.debug('Redis connection closed');
        }
        this.isConnected = false;
      });

      this.redis.on('error', (error) => {
        // Mark as not connected but do not schedule manual reconnects —
        // ioredis manages reconnection via its built-in retry strategy.
        this.isConnected = false;
        const now = Date.now();
        if (now - this.lastErrorLogAt > this.errorLogCooldownMs) {
          this.lastErrorLogAt = now;
          this.logger.debug(
            'Redis connection error (handled by ioredis):',
            getErrorMessage(error),
          );
        }
      });

      void this.connectRedis();
    } else {
      this.logger.log('Redis is disabled, operating in in-memory mode.');
      this.redis = null;
    }

    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.memoryStore.entries()) {
        if (data.expiry && data.expiry < now) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000);
  }

  private async connectRedis() {
    if (!this.redis || this.isConnected) {
      return;
    }
    this.logger.log('Attempting to connect to Redis...');
    try {
      await this.redis.connect();
    } catch (err) {
      this.logger.debug(
        'Initial Redis connection failed:',
        getErrorMessage(err),
      );
      this.isConnected = false;
    }
  }

  // Manual reconnection scheduling removed; ioredis' built-in retry
  // strategy is relied upon instead to avoid duplicate reconnect logic.

  private getFromMemory(key: string): Promise<string | null> {
    const data = this.memoryStore.get(key);
    if (!data) {
      return Promise.resolve(null);
    }
    if (data.expiry && data.expiry < Date.now()) {
      this.memoryStore.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(data.value);
  }

  private setInMemory(key: string, value: string, ttlSeconds?: number): void {
    const data: { value: string; expiry?: number } = { value };
    if (ttlSeconds) {
      data.expiry = Date.now() + ttlSeconds * 1000;
    }
    this.memoryStore.set(key, data);
  }

  private getConnectedClient(): Redis | null {
    return this.isConnected && this.redis ? this.redis : null;
  }

  async get<T = any>(key: string): Promise<T | null> {
    const client = this.getConnectedClient();
    const raw = client
      ? await (async () => {
          try {
            const result = await client.get(key);
            return result;
          } catch (error: any) {
            this.logger.warn(
              'Redis get failed, falling back to memory:',
              getErrorMessage(error),
            );
            return null;
          }
        })()
      : await this.getFromMemory(key);

    if (raw === null || raw === undefined) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      return parsed;
    } catch (e) {
      this.logger.warn(
        `Failed to parse JSON for key ${key}. Returning raw value. Error: ${getErrorMessage(e)}`,
      );
      return raw as unknown as T;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    let strValue: string;
    if (typeof value === 'string') {
      strValue = value;
    } else if (typeof value === 'object' && value !== null) {
      // Safely serialize objects that may contain BigInt values (from Prisma)
      strValue = JSON.stringify(value, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
    } else {
      strValue = String(value);
    }

    this.setInMemory(key, strValue, ttlSeconds);
    const client = this.getConnectedClient();
    if (client) {
      try {
        if (ttlSeconds) {
          await client.setex(key, ttlSeconds, strValue);
        } else {
          await client.set(key, strValue);
        }
      } catch (error: any) {
        this.logger.error(
          'Redis set failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
  }

  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.del(key);
      } catch (error) {
        this.logger.warn(
          'Redis del failed, using memory only:',
          getErrorMessage(error),
        );
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        const result = await client.exists(key);
        return result === 1;
      } catch (error) {
        this.logger.warn(
          'Redis exists failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    return this.memoryStore.has(key);
  }

  async increment(key: string): Promise<number> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        return await client.incr(key);
      } catch (error) {
        this.logger.warn(
          'Redis increment failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    const current = await this.getFromMemory(key);
    const newValue = (parseInt(current || '0') + 1).toString();
    this.setInMemory(key, newValue);
    return parseInt(newValue);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const current = await this.getFromMemory(key);
    if (current !== null) {
      this.setInMemory(key, current, seconds);
    } else {
      this.setMemoryExpiry(key, seconds);
    }

    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.expire(key, seconds);
      } catch (error) {
        this.logger.warn(
          'Redis expire failed, setting memory expiry:',
          getErrorMessage(error),
        );
        this.setMemoryExpiry(key, seconds);
      }
    } else {
      this.setMemoryExpiry(key, seconds);
    }
  }

  async decrement(key: string): Promise<number> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        return await client.decr(key);
      } catch (error) {
        this.logger.warn(
          'Redis decr failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    const current = await this.getFromMemory(key);
    const newValue = (parseInt(current || '0') - 1).toString();
    this.setInMemory(key, newValue);
    return parseInt(newValue);
  }

  private setMemoryExpiry(key: string, seconds: number): void {
    const data = this.memoryStore.get(key);
    if (data) {
      data.expiry = Date.now() + seconds * 1000;
      this.memoryStore.set(key, data);
    }
  }

  async setHash(key: string, field: string, value: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.hset(key, field, value);
      } catch (error) {
        this.logger.warn(
          'Redis hset failed, using memory only:',
          getErrorMessage(error),
        );
      }
    }
    const hashKey = `${key}:${field}`;
    this.setInMemory(hashKey, value);
  }

  async getHash(key: string, field: string): Promise<string | null> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        return await client.hget(key, field);
      } catch (error) {
        this.logger.warn(
          'Redis hget failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    const hashKey = `${key}:${field}`;
    return this.getFromMemory(hashKey);
  }

  async getAllHash(key: string): Promise<Record<string, string>> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        return await client.hgetall(key);
      } catch (error) {
        this.logger.warn(
          'Redis hgetall failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    const result: Record<string, string> = {};
    for (const [storeKey, data] of this.memoryStore.entries()) {
      if (storeKey.startsWith(`${key}:`)) {
        const field = storeKey.slice(key.length + 1);
        result[field] = data.value;
      }
    }
    return result;
  }

  async deleteHash(key: string, field: string): Promise<void> {
    const hashKey = `${key}:${field}`;
    this.memoryStore.delete(hashKey);
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.hdel(key, field);
      } catch (error) {
        this.logger.warn(
          'Redis hdel failed, using memory only:',
          getErrorMessage(error),
        );
      }
    }
  }

  async setList(key: string, values: string[]): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.rpush(key, ...values);
        return;
      } catch (err) {
        this.logger.warn(
          'Redis rpush failed, falling back to memory',
          getErrorMessage(err),
        );
      }
    }
    this.setInMemory(key, JSON.stringify(values));
  }

  async getList(key: string, start: number, end: number): Promise<string[]> {
    const client = this.getConnectedClient();
    if (!client) {
      this.logger.debug(
        'Redis not connected, returning empty array for getList operation',
      );
      return [];
    }
    return await client.lrange(key, start, end);
  }

  async addToSet(key: string, value: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.sadd(key, value);
        return;
      } catch (err) {
        this.logger.warn(
          'Redis sadd failed, falling back to memory',
          getErrorMessage(err),
        );
      }
    }
    const existing = (await this.getFromMemory(key)) || '';
    const set = new Set(existing ? JSON.parse(existing) : []);
    set.add(value);
    this.setInMemory(key, JSON.stringify(Array.from(set)));
  }

  async getSetMembers(key: string): Promise<string[]> {
    const client = this.getConnectedClient();
    if (!client) {
      this.logger.debug(
        'Redis not connected, returning empty array for getSetMembers operation',
      );
      return [];
    }
    return await client.smembers(key);
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.srem(key, value);
        return;
      } catch (err) {
        this.logger.warn(
          'Redis srem failed, falling back to memory',
          getErrorMessage(err),
        );
      }
    }
    const existing = (await this.getFromMemory(key)) || '';
    const arr = existing ? JSON.parse(existing) : [];
    const filtered = arr.filter((v: string) => v !== value);
    this.setInMemory(key, JSON.stringify(filtered));
  }

  async publish(channel: string, message: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.publish(channel, message);
        return;
      } catch (err) {
        this.logger.warn(
          'Redis publish failed, ignoring',
          getErrorMessage(err),
        );
      }
    }
    this.logger.debug(`Publish skipped for ${channel} (redis disabled)`);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    if (!this.getConnectedClient()) {
      this.logger.debug('Redis not connected, skipping subscribe operation');
      return;
    }

    if (!this.subscriber) {
      const subConn = buildRedisConnection(this.configService);
      this.subscriber =
        typeof subConn === 'string' ? new Redis(subConn) : new Redis(subConn);
      this.subscriber.on('error', (err) => {
        const now = Date.now();
        if (now - this.lastErrorLogAt > this.errorLogCooldownMs) {
          this.lastErrorLogAt = now;
          this.logger.debug('Redis subscriber error:', getErrorMessage(err));
        }
      });
      try {
        await this.subscriber.connect();
      } catch (err) {
        const now = Date.now();
        if (now - this.lastErrorLogAt > this.errorLogCooldownMs) {
          this.lastErrorLogAt = now;
          this.logger.debug('Redis subscriber connect failed:', getErrorMessage(err));
        }
      }
    }

    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async onApplicationShutdown(): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      await client.quit();
    }
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch (_e) {
        // ignore
      }
    }
  }

  async ttl(key: string): Promise<number> {
    const client = this.getConnectedClient();
    if (!client) {
      return -2;
    }
    try {
      const res = await client.ttl(key);
      return res;
    } catch (err) {
      this.logger.warn('Redis ttl failed, returning -2', getErrorMessage(err));
      return -2;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const client = this.getConnectedClient();
    if (!client) {
      return [];
    }
    try {
      return await client.keys(pattern);
    } catch (err) {
      this.logger.warn(
        'Redis keys failed, returning empty list',
        getErrorMessage(err),
      );
      return [];
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
        return;
      } catch (err) {
        this.logger.warn(
          'Redis delPattern failed, falling back to memory',
          getErrorMessage(err),
        );
      }
    }

    const toDelete: string[] = [];
    for (const k of this.memoryStore.keys()) {
      if (k.match(new RegExp(pattern.replace(/\*/g, '.*')))) {
        toDelete.push(k);
      }
    }
    for (const k of toDelete) {
      this.memoryStore.delete(k);
    }
  }

  get client(): Redis | null {
    return this.redis;
  }
}
