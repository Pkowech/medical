import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import buildRedisConnection from './redis.helper';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '#common/utils/error.utils';

const VALUE_ENCODING_PREFIX = '\0medtrack:v1:';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly logger = new Logger(RedisService.name);
  private readonly shouldEnableRedis =
    process.env.ENABLE_REDIS !== 'false' &&
    (process.env.ENABLE_REDIS === 'true' || Boolean(process.env.REDIS_URL));
  private readonly maxMemoryEntries: number;
  private readonly maxMemoryBytes: number;
  private isConnected = false;
  private subscriber: Redis | null = null;
  private memoryStore: Map<
    string,
    { value: string; expiry?: number; bytes: number }
  > = new Map();
  private memoryStoreSizeBytes = 0;
  private readonly memoryCleanupTimer: NodeJS.Timeout;
  private hasLoggedRedisError = false;
  // Timestamp of last logged error to throttle repetitive logs
  private lastErrorLogAt = 0;
  private lastMemoryEvictionLogAt = 0;
  // Minimum interval between logging the same error (ms)
  private errorLogCooldownMs = 60_000; // 1 minute

  constructor(private configService: ConfigService) {
    this.maxMemoryEntries = configService.get<number>(
      'REDIS_MEMORY_MAX_ENTRIES',
      10000,
    );
    this.maxMemoryBytes = configService.get<number>(
      'REDIS_MEMORY_MAX_BYTES',
      64 * 1024 * 1024,
    );

    if (this.shouldEnableRedis) {
      const redisConn = buildRedisConnection(this.configService);
      this.redis = new Redis({ ...redisConn, lazyConnect: true });

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
        if (!this.hasLoggedRedisError) {
          this.hasLoggedRedisError = true;
          this.logger.warn(
            'Redis connection issue detected; reconnect attempts are managed by ioredis. If Redis is unavailable, the service will continue with the local fallback cache.',
            getErrorMessage(error),
          );
        }
      });
    } else {
      this.logger.log('Redis is disabled, operating in in-memory mode.');
      this.redis = null;
    }

    this.memoryCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.memoryStore.entries()) {
        if (data.expiry !== undefined && data.expiry <= now) {
          this.deleteFromMemory(key);
        }
      }
    }, 60000);
    this.memoryCleanupTimer.unref();
  }

  async onModuleInit() {
    if (this.shouldEnableRedis) {
      await this.connectRedis();
      if (this.isConnected) {
        this.logger.log('Redis connection validated during startup');
      }
    }
  }

  private async connectRedis(throwOnFail = false) {
    if (!this.redis || this.isConnected) {
      return;
    }
    this.logger.log('Attempting to connect to Redis...');
    try {
      await this.redis.connect();
      if (this.isConnected) {
        this.logger.debug(
          'Redis connect() completed and ready event already fired',
        );
      } else {
        this.logger.debug('Redis connect() completed; waiting for ready event');
      }
    } catch (err) {
      this.logger.debug(
        'Initial Redis connection failed:',
        getErrorMessage(err),
      );
      this.isConnected = false;
      if (throwOnFail) {
        throw err;
      }
    }
  }

  // Manual reconnection scheduling removed; ioredis' built-in retry
  // strategy is relied upon instead to avoid duplicate reconnect logic.

  private getFromMemory(key: string): Promise<string | null> {
    const data = this.memoryStore.get(key);
    if (!data) {
      return Promise.resolve(null);
    }
    if (data.expiry !== undefined && data.expiry <= Date.now()) {
      this.deleteFromMemory(key);
      return Promise.resolve(null);
    }
    this.memoryStore.delete(key);
    this.memoryStore.set(key, data);
    return Promise.resolve(data.value);
  }

  private setInMemory(key: string, value: string, ttlSeconds?: number): void {
    const bytes = Buffer.byteLength(key) + Buffer.byteLength(value);
    this.deleteFromMemory(key);
    if (bytes > this.maxMemoryBytes) {
      this.logMemoryLimit(
        `Redis fallback value exceeds the memory limit (${this.maxMemoryBytes} bytes); value was not cached.`,
      );
      return;
    }

    const data: { value: string; expiry?: number; bytes: number } = {
      value,
      bytes,
    };
    if (ttlSeconds !== undefined) {
      data.expiry = Date.now() + ttlSeconds * 1000;
    }
    this.memoryStore.set(key, data);
    this.memoryStoreSizeBytes += bytes;
    this.removeExpiredMemoryEntries();
    while (
      this.memoryStore.size > this.maxMemoryEntries ||
      this.memoryStoreSizeBytes > this.maxMemoryBytes
    ) {
      const oldestKey = this.memoryStore.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.deleteFromMemory(oldestKey);
      this.logMemoryLimit(
        `Redis fallback memory limit reached (${this.maxMemoryEntries} entries or ${this.maxMemoryBytes} bytes); evicting least-recently-used entries.`,
      );
    }
  }

  private logMemoryLimit(message: string): void {
    const now = Date.now();
    if (now - this.lastMemoryEvictionLogAt >= this.errorLogCooldownMs) {
      this.lastMemoryEvictionLogAt = now;
      this.logger.warn(message);
    }
  }

  private removeExpiredMemoryEntries(): void {
    const now = Date.now();
    for (const [key, data] of this.memoryStore.entries()) {
      if (data.expiry !== undefined && data.expiry <= now) {
        this.deleteFromMemory(key);
      }
    }
  }

  private deleteFromMemory(key: string): void {
    const data = this.memoryStore.get(key);
    if (data) {
      this.memoryStore.delete(key);
      this.memoryStoreSizeBytes -= data.bytes;
    }
  }

  private getConnectedClient(): Redis | null {
    return this.isConnected && this.redis ? this.redis : null;
  }

  get isEnabled(): boolean {
    return this.shouldEnableRedis;
  }

  async ping(): Promise<string> {
    const client = this.getConnectedClient();
    if (!client) {
      throw new Error('Redis is enabled but not connected');
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        client.ping(),
        new Promise<string>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Redis health check timed out')),
            3000,
          );
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const client = this.getConnectedClient();
    let raw: string | null;
    if (client) {
      try {
        raw = await client.get(key);
        this.deleteFromMemory(key);
      } catch (error) {
        this.logger.warn(
          'Redis get failed, falling back to memory:',
          getErrorMessage(error),
        );
        raw = await this.getFromMemory(key);
      }
    } else {
      raw = await this.getFromMemory(key);
    }

    if (raw === null || raw === undefined) {
      return null;
    }

    if (raw.startsWith(`${VALUE_ENCODING_PREFIX}string:`)) {
      return raw.slice(`${VALUE_ENCODING_PREFIX}string:`.length) as T;
    }
    if (raw.startsWith(`${VALUE_ENCODING_PREFIX}boolean:`)) {
      return (raw.slice(`${VALUE_ENCODING_PREFIX}boolean:`.length) ===
        'true') as T;
    }
    if (raw.startsWith(`${VALUE_ENCODING_PREFIX}number:`)) {
      return Number(raw.slice(`${VALUE_ENCODING_PREFIX}number:`.length)) as T;
    }
    if (raw === `${VALUE_ENCODING_PREFIX}null:`) {
      return null;
    }
    if (raw.startsWith(`${VALUE_ENCODING_PREFIX}json:`)) {
      try {
        return JSON.parse(
          raw.slice(`${VALUE_ENCODING_PREFIX}json:`.length),
        ) as T;
      } catch (error) {
        this.logger.warn(
          `Failed to parse encoded JSON for key ${key}: ${getErrorMessage(error)}`,
        );
        return raw as T;
      }
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as T)
        : (raw as T);
    } catch {
      return raw as T;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const strValue = this.serializeValue(value);

    const client = this.getConnectedClient();
    if (client) {
      try {
        if (ttlSeconds !== undefined) {
          await client.setex(key, ttlSeconds, strValue);
        } else {
          await client.set(key, strValue);
        }
        this.deleteFromMemory(key);
        return;
      } catch (error) {
        this.logger.error(
          'Redis set failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    this.setInMemory(key, strValue, ttlSeconds);
  }

  private serializeValue(value: unknown): string {
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed !== null && typeof parsed === 'object') {
          return `${VALUE_ENCODING_PREFIX}json:${value}`;
        }
      } catch {
        return `${VALUE_ENCODING_PREFIX}string:${value}`;
      }
      return `${VALUE_ENCODING_PREFIX}string:${value}`;
    }
    if (value === null) {
      return `${VALUE_ENCODING_PREFIX}null:`;
    }
    if (typeof value === 'number') {
      return `${VALUE_ENCODING_PREFIX}number:${value}`;
    }
    if (typeof value === 'boolean') {
      return `${VALUE_ENCODING_PREFIX}boolean:${value}`;
    }
    if (typeof value === 'object') {
      const serialized = JSON.stringify(value, (_key, nestedValue) =>
        typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
      );
      if (serialized !== undefined) {
        return `${VALUE_ENCODING_PREFIX}json:${serialized}`;
      }
    }
    return `${VALUE_ENCODING_PREFIX}string:${String(value)}`;
  }

  async del(key: string): Promise<void> {
    this.deleteFromMemory(key);
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
        this.deleteFromMemory(key);
        return result === 1;
      } catch (error) {
        this.logger.warn(
          'Redis exists failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    return (await this.getFromMemory(key)) !== null;
  }

  async increment(key: string): Promise<number> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        const value = await client.incr(key);
        this.deleteFromMemory(key);
        return value;
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

  async incrementWithExpiry(key: string, seconds: number): Promise<number> {
    if (!Number.isInteger(seconds) || seconds <= 0) {
      throw new Error('seconds must be a positive integer');
    }

    const client = this.getConnectedClient();
    if (client) {
      try {
        const result = await client.eval(
          "local value = redis.call('INCR', KEYS[1]); if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return value",
          1,
          key,
          seconds,
        );
        this.deleteFromMemory(key);
        return Number(result);
      } catch (error) {
        this.logger.warn(
          'Redis increment with expiry failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }

    const current = await this.getFromMemory(key);
    const next = (parseInt(current || '0', 10) + 1).toString();
    const existing = this.memoryStore.get(key);
    const ttl =
      !existing || current === null
        ? seconds
        : existing.expiry !== undefined
          ? Math.max(1, Math.ceil((existing.expiry - Date.now()) / 1000))
          : undefined;
    this.setInMemory(key, next, ttl);
    return Number(next);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.expire(key, seconds);
        this.setMemoryExpiry(key, seconds);
        return;
      } catch (error) {
        this.logger.warn(
          'Redis expire failed, setting memory expiry:',
          getErrorMessage(error),
        );
        this.setMemoryExpiry(key, seconds);
        return;
      }
    }
    this.setMemoryExpiry(key, seconds);
  }

  async decrement(key: string): Promise<number> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        const value = await client.decr(key);
        this.deleteFromMemory(key);
        return value;
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
        this.deleteFromMemory(`${key}:${field}`);
        return;
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
        const value = await client.hget(key, field);
        this.deleteFromMemory(`${key}:${field}`);
        return value;
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
        const values = await client.hgetall(key);
        this.deleteMemoryPrefix(`${key}:`);
        return values;
      } catch (error) {
        this.logger.warn(
          'Redis hgetall failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    this.removeExpiredMemoryEntries();
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
    this.deleteFromMemory(hashKey);
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.hdel(key, field);
        return;
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
        const transaction = client.multi();
        transaction.del(key);
        if (values.length > 0) {
          transaction.rpush(key, ...values);
        }
        const results = await transaction.exec();
        if (!results) {
          throw new Error('Redis list replacement transaction was aborted');
        }
        const failedCommand = results.find(([error]) => error !== null);
        if (failedCommand?.[0]) {
          throw failedCommand[0];
        }
        this.deleteFromMemory(key);
        return;
      } catch (err) {
        this.logger.warn(
          'Redis list replacement failed, using memory:',
          getErrorMessage(err),
        );
      }
    }
    this.setInMemory(key, JSON.stringify(values));
  }

  async prependList(
    key: string,
    value: string,
    maxLength: number,
  ): Promise<void> {
    if (!Number.isInteger(maxLength) || maxLength < 1) {
      throw new Error('maxLength must be a positive integer');
    }

    const client = this.getConnectedClient();
    if (client) {
      try {
        const results = await client
          .multi()
          .lpush(key, value)
          .ltrim(key, 0, maxLength - 1)
          .exec();
        if (!results) {
          throw new Error('Redis bounded list transaction was aborted');
        }
        const failedCommand = results.find(([error]) => error !== null);
        if (failedCommand?.[0]) {
          throw failedCommand[0];
        }
        this.deleteFromMemory(key);
        return;
      } catch (error) {
        this.logger.warn(
          'Redis bounded list update failed, using memory:',
          getErrorMessage(error),
        );
      }
    }

    const current = await this.getFromMemory(key);
    const values: string[] = current ? JSON.parse(current) : [];
    this.setInMemory(
      key,
      JSON.stringify([value, ...values].slice(0, maxLength)),
    );
  }

  async getList(key: string, start: number, end: number): Promise<string[]> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        const values = await client.lrange(key, start, end);
        this.deleteFromMemory(key);
        return values;
      } catch (error) {
        this.logger.warn(
          'Redis list read failed, using memory:',
          getErrorMessage(error),
        );
      }
    }

    const raw = await this.getFromMemory(key);
    const values: string[] = raw ? JSON.parse(raw) : [];
    const normalizedStart =
      start < 0 ? Math.max(values.length + start, 0) : start;
    const normalizedEnd = end < 0 ? values.length + end : end;
    return normalizedEnd < normalizedStart
      ? []
      : values.slice(normalizedStart, normalizedEnd + 1);
  }

  async addToSet(key: string, value: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.sadd(key, value);
        this.deleteFromMemory(key);
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
    if (client) {
      try {
        const values = await client.smembers(key);
        this.deleteFromMemory(key);
        return values;
      } catch (error) {
        this.logger.warn(
          'Redis smembers failed, falling back to memory:',
          getErrorMessage(error),
        );
      }
    }
    const raw = await this.getFromMemory(key);
    return raw ? JSON.parse(raw) : [];
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    const client = this.getConnectedClient();
    if (client) {
      try {
        await client.srem(key, value);
        this.deleteFromMemory(key);
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
      this.subscriber = new Redis({ ...subConn, lazyConnect: true });
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
          this.logger.debug(
            'Redis subscriber connect failed:',
            getErrorMessage(err),
          );
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

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.memoryCleanupTimer);
    for (const client of [this.redis, this.subscriber]) {
      if (client && client.status !== 'end') {
        client.disconnect();
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
      return await this.scanKeys(client, pattern);
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
        await this.scanKeyBatches(client, pattern, async (keys) => {
          for (let offset = 0; offset < keys.length; offset += 500) {
            await client.del(...keys.slice(offset, offset + 500));
          }
        });
        return;
      } catch (err) {
        this.logger.warn(
          'Redis delPattern failed, falling back to memory',
          getErrorMessage(err),
        );
      }
    }

    const toDelete: string[] = [];
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const matcher = new RegExp(`^${regexPattern}$`);
    for (const k of this.memoryStore.keys()) {
      if (matcher.test(k)) {
        toDelete.push(k);
      }
    }
    for (const k of toDelete) {
      this.deleteFromMemory(k);
    }
  }

  get client(): Redis | null {
    return this.redis;
  }

  private async scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys = new Set<string>();
    await this.scanKeyBatches(client, pattern, (batch) => {
      for (const key of batch) {
        keys.add(key);
      }
    });
    return Array.from(keys);
  }

  private async scanKeyBatches(
    client: Redis,
    pattern: string,
    handleBatch: (keys: string[]) => void | Promise<void>,
  ): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, batchKeys] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        500,
      );
      cursor = nextCursor;
      if (batchKeys.length > 0) {
        await handleBatch(batchKeys);
      }
    } while (cursor !== '0');
  }

  private deleteMemoryPrefix(prefix: string): void {
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        this.deleteFromMemory(key);
      }
    }
  }
}
