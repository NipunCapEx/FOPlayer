import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assessRisk } from '../src/risk-engine.js';
import {
  FirestoreMonitoringRepository,
  FirestoreStrategyStore,
} from '../src/firestore-store.js';
import type {
  CollectionReferencePort,
  DocumentReferencePort,
  DocumentSnapshotPort,
  FirestorePort,
  QueryPort,
  QuerySnapshotPort,
} from '../src/firestore-port.js';
import type { FirebaseAdminService } from '../src/firebase-admin.service.js';

type Data = Record<string, unknown>;

class FakeSnapshot implements DocumentSnapshotPort {
  constructor(
    readonly id: string,
    private readonly value: Data | undefined,
  ) {}

  get exists(): boolean {
    return this.value !== undefined;
  }

  data(): Data | undefined {
    return this.value ? { ...this.value } : undefined;
  }
}

class FakeFirestore implements FirestorePort {
  private readonly collections = new Map<string, Map<string, Data>>();
  private nextId = 0;

  collection(name: string): CollectionReferencePort {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return new FakeCollection(this, name);
  }

  records(name: string): Map<string, Data> {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name)!;
  }

  allocateId(): string {
    this.nextId += 1;
    return `generated-${this.nextId}`;
  }
}

class FakeDocumentReference implements DocumentReferencePort {
  constructor(
    private readonly db: FakeFirestore,
    private readonly collectionName: string,
    readonly id: string,
  ) {}

  async get(): Promise<DocumentSnapshotPort> {
    return new FakeSnapshot(
      this.id,
      this.db.records(this.collectionName).get(this.id),
    );
  }

  async set(data: Data, options?: { merge?: boolean }): Promise<void> {
    const records = this.db.records(this.collectionName);
    const current = records.get(this.id);
    records.set(
      this.id,
      options?.merge && current ? { ...current, ...data } : { ...data },
    );
  }

  async update(data: Data): Promise<void> {
    const records = this.db.records(this.collectionName);
    const current = records.get(this.id);
    if (!current) throw new Error('document does not exist');
    records.set(this.id, { ...current, ...data });
  }

  async create(data: Data): Promise<void> {
    const records = this.db.records(this.collectionName);
    if (records.has(this.id)) {
      throw Object.assign(new Error('already exists'), { code: 6 });
    }
    records.set(this.id, { ...data });
  }
}

class FakeQuery implements QueryPort {
  constructor(
    protected readonly db: FakeFirestore,
    protected readonly collectionName: string,
    protected readonly filters: Array<[string, unknown]> = [],
    protected readonly sort?: { field: string; direction: 'asc' | 'desc' },
    protected readonly maximum?: number,
  ) {}

  where(field: string, _operator: '==', value: unknown): QueryPort {
    return new FakeQuery(
      this.db,
      this.collectionName,
      [...this.filters, [field, value]],
      this.sort,
      this.maximum,
    );
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryPort {
    return new FakeQuery(
      this.db,
      this.collectionName,
      this.filters,
      { field, direction },
      this.maximum,
    );
  }

  limit(count: number): QueryPort {
    return new FakeQuery(
      this.db,
      this.collectionName,
      this.filters,
      this.sort,
      count,
    );
  }

  async get(): Promise<QuerySnapshotPort> {
    let entries = [...this.db.records(this.collectionName).entries()].filter(
      ([, data]) =>
        this.filters.every(([field, expected]) => data[field] === expected),
    );
    if (this.sort) {
      const { field, direction } = this.sort;
      entries.sort((a, b) => {
        const left = comparable(a[1][field]);
        const right = comparable(b[1][field]);
        const result = left < right ? -1 : left > right ? 1 : 0;
        return result * (direction === 'asc' ? 1 : -1);
      });
    }
    if (this.maximum !== undefined) entries = entries.slice(0, this.maximum);
    const docs = entries.map(([id, data]) => new FakeSnapshot(id, data));
    return { docs, empty: docs.length === 0 };
  }
}

class FakeCollection extends FakeQuery implements CollectionReferencePort {
  constructor(
    private readonly firestore: FakeFirestore,
    private readonly name: string,
  ) {
    super(firestore, name);
  }

  doc(id?: string): DocumentReferencePort {
    return new FakeDocumentReference(
      this.firestore,
      this.name,
      id ?? this.firestore.allocateId(),
    );
  }

  async add(data: Data): Promise<DocumentReferencePort> {
    const reference = this.doc();
    await reference.set(data);
    return reference;
  }
}

function comparable(value: unknown): number | string {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return (value.toDate as () => Date)().getTime();
  }
  return 0;
}

function createStores() {
  const db = new FakeFirestore();
  const firebase = {
    get firestore() {
      return db;
    },
  } as unknown as FirebaseAdminService;
  return {
    db,
    strategies: new FirestoreStrategyStore(firebase),
    monitoring: new FirestoreMonitoringRepository(firebase),
  };
}

describe('FirestoreStrategyStore — owner isolation', () => {
  it('scopes strategy reads and updates to the authenticated owner', async () => {
    const { strategies } = createStores();
    const first = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
      entryDate: '2026-10-16',
      expiryDate: '2026-11-26',
      thresholds: {
        cautionPercent: 6,
        criticalPercent: 8,
        breachedPercent: 10,
      },
    });
    await strategies.createForOwner('owner-b', {
      symbol: 'SBICARD',
      entryPrice: 800,
      active: true,
    });

    expect(await strategies.listForOwner('owner-a')).toHaveLength(1);
    await expect(
      strategies.updateForOwner('owner-b', first.id, { active: false }),
    ).resolves.toBeNull();
    await expect(
      strategies.updateForOwner('owner-a', 'missing-strategy', {
        active: false,
      }),
    ).resolves.toBeNull();
    await expect(
      strategies.updateForOwner('owner-a', first.id, {
        entryPrice: 1200,
        active: false,
      }),
    ).resolves.toMatchObject({ entryPrice: 1200, active: false });
  });

  it('rejects concurrent duplicate active strategies per owner and symbol', async () => {
    const { strategies } = createStores();
    const results = await Promise.allSettled([
      strategies.createForOwner('owner-a', {
        symbol: 'RELIANCE',
        entryPrice: 1000,
        active: true,
      }),
      strategies.createForOwner('owner-a', {
        symbol: 'RELIANCE',
        entryPrice: 1100,
        active: true,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      (await strategies.listForOwner('owner-a')).filter((item) => item.active),
    ).toHaveLength(1);
  });

  it('reactivates inactive strategies without losing their identity', async () => {
    const { strategies } = createStores();
    const original = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
      entryDate: '2026-10-15',
      expiryDate: '2026-10-29',
      thresholds: {
        cautionPercent: 5,
        criticalPercent: 7,
        breachedPercent: 9,
      },
    });
    await strategies.updateForOwner('owner-a', original.id, { active: false });

    const reactivated = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1200,
      active: true,
      entryDate: '2026-10-16',
      expiryDate: '2026-11-26',
    });

    expect(reactivated.id).toBe(original.id);
    expect(reactivated).toMatchObject({
      entryPrice: 1200,
      active: true,
      entryDate: '2026-10-16',
      expiryDate: '2026-11-26',
      thresholds: {
        cautionPercent: 6,
        criticalPercent: 8,
        breachedPercent: 10,
      },
      ownerUid: 'owner-a',
    });
    await expect(strategies.listForOwner('owner-a')).resolves.toMatchObject([
      expect.objectContaining({
        id: original.id,
        entryDate: '2026-10-16',
        expiryDate: '2026-11-26',
      }),
    ]);

    await strategies.updateForOwner('owner-a', original.id, { active: false });
    const reactivatedWithoutDate = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1300,
      active: true,
    });
    expect(reactivatedWithoutDate).toMatchObject({
      id: original.id,
      entryDate: '2026-10-16',
      expiryDate: '2026-11-26',
    });
  });

  it('allows reactivation only through the stable owner-symbol identity', async () => {
    const { db, strategies } = createStores();
    const stable = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });
    await strategies.updateForOwner('owner-a', stable.id, { active: false });
    await expect(
      strategies.updateForOwner('owner-a', stable.id, { active: true }),
    ).resolves.toMatchObject({ id: stable.id, active: true });

    await db
      .collection('strategies')
      .doc('legacy-strategy')
      .set({
        id: 'legacy-strategy',
        ownerUid: 'owner-a',
        symbol: 'JSWSTEEL',
        entryPrice: 900,
        active: false,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      });
    await expect(
      strategies.updateForOwner('owner-a', 'legacy-strategy', {
        active: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reactivation when another active record already owns the symbol', async () => {
    const { db, strategies } = createStores();
    const stable = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });
    await strategies.updateForOwner('owner-a', stable.id, { active: false });
    await db
      .collection('strategies')
      .doc('legacy-active')
      .set({
        ownerUid: 'owner-a',
        symbol: 'RELIANCE',
        entryPrice: 1100,
        active: true,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      });

    await expect(
      strategies.updateForOwner('owner-a', stable.id, { active: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a conflicting record at the deterministic owner-symbol identity', async () => {
    const { db, strategies } = createStores();
    const id = createHash('sha256')
      .update('owner-a')
      .update('\0')
      .update('RELIANCE')
      .digest('hex');
    await db
      .collection('strategies')
      .doc(id)
      .set({
        ownerUid: 'owner-a',
        symbol: 'JSWSTEEL',
        entryPrice: 900,
        active: false,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      });

    await expect(
      strategies.createForOwner('owner-a', {
        symbol: 'RELIANCE',
        entryPrice: 1000,
        active: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('filters malformed strategy documents', async () => {
    const { db, strategies } = createStores();
    await db.collection('strategies').doc('bad-symbol').set({
      ownerUid: 'owner-a',
      symbol: 'UNKNOWN',
      entryPrice: 100,
      active: true,
    });
    await db.collection('strategies').doc('bad-price').set({
      ownerUid: 'owner-a',
      symbol: 'RELIANCE',
      entryPrice: Number.NaN,
      active: true,
    });
    await db.collection('strategies').doc('no-owner').set({
      symbol: 'RELIANCE',
      entryPrice: 100,
      active: true,
    });

    expect(await strategies.listForOwner('owner-a')).toEqual([]);
  });

  it('returns only owner-scoped snapshots and alert history', async () => {
    const { db, strategies } = createStores();
    const own = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });
    await strategies.createForOwner('owner-b', {
      symbol: 'SBICARD',
      entryPrice: 800,
      active: true,
    });
    const assessment = assessRisk({
      symbol: 'RELIANCE',
      entryPrice: 1000,
      spotPrice: 1080,
    });
    const secondOwn = await strategies.createForOwner('owner-a', {
      symbol: 'SBICARD',
      entryPrice: 800,
      active: true,
    });
    await db
      .collection('strategySnapshots')
      .doc(own.id)
      .set({
        assessment,
        source: 'fixture',
        exchangeTimestamp: new Date('2026-10-20T10:00:00Z'),
        fetchedAt: new Date('2026-10-20T10:00:01Z'),
        recordedAt: new Date('2026-10-20T10:00:02Z'),
      });
    await db
      .collection('strategySnapshots')
      .doc(secondOwn.id)
      .set({
        assessment,
        source: 'fixture-2',
        exchangeTimestamp: '2026-10-20T10:00:00Z',
        fetchedAt: { toDate: () => new Date('2026-10-20T10:00:01Z') },
        recordedAt: 'not-a-date',
      });
    await db
      .collection('alerts')
      .doc('own-alert')
      .set({
        ownerUid: 'owner-a',
        createdAt: new Date('2026-10-20T10:00:00Z'),
        kind: 'caution',
      });
    await db
      .collection('alerts')
      .doc('foreign-alert')
      .set({
        ownerUid: 'owner-b',
        createdAt: new Date('2026-10-20T10:01:00Z'),
        kind: 'critical',
      });

    const dashboard = await strategies.getDashboard('owner-a');
    expect(dashboard.strategies).toHaveLength(2);
    expect(dashboard.snapshots[0]?.assessment.level).toBe('caution');
    expect(dashboard.snapshots[1]?.exchangeTimestamp).toEqual(
      new Date('2026-10-20T10:00:00Z'),
    );
    expect(dashboard.snapshots[1]?.recordedAt.getTime()).toBe(0);
    expect(dashboard.snapshots[1]?.historicalCloses).toEqual([]);
    expect(dashboard.alerts.map((alert) => alert.id)).toEqual(['own-alert']);
  });

  it('registers device tokens only for strategies owned by the caller', async () => {
    const { db, strategies } = createStores();
    const strategy = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });

    await expect(
      strategies.registerDeviceToken('owner-b', strategy.id, 'device-token'),
    ).resolves.toBe(false);
    await expect(
      strategies.registerDeviceToken(
        'owner-a',
        'missing-strategy',
        'device-token',
      ),
    ).resolves.toBe(false);
    await expect(
      strategies.registerDeviceToken('owner-a', strategy.id, 'device-token'),
    ).resolves.toBe(true);
    await strategies.registerDeviceToken(
      'owner-a',
      strategy.id,
      'another-device-token',
    );
    await db.collection('deviceTokens').doc('non-string-token').set({
      strategyId: strategy.id,
      active: true,
      token: 123,
    });
    await expect(
      strategies.listDeviceTokensForStrategy(strategy.id),
    ).resolves.toEqual(['device-token', 'another-device-token']);
  });
});

describe('FirestoreMonitoringRepository — assessment and outbox', () => {
  it('lists valid active strategies and retains owner context', async () => {
    const { db, strategies, monitoring } = createStores();
    const valid = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
      expiryDate: '2026-11-26',
    });
    await strategies.createForOwner('owner-b', {
      symbol: 'JSWSTEEL',
      entryPrice: 900,
      active: false,
    });
    await db.collection('strategies').doc('invalid').set({
      ownerUid: 'owner-a',
      symbol: 'BAD',
      entryPrice: 100,
      active: true,
    });

    expect(await monitoring.listActiveStrategies()).toEqual([
      expect.objectContaining({
        id: valid.id,
        ownerUid: 'owner-a',
        expiryDate: '2026-11-26',
      }),
    ]);
  });

  it('persists assessments and round-trips risk episode state', async () => {
    const { strategies, monitoring, db } = createStores();
    const strategy = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });
    const snapshot = {
      symbol: 'RELIANCE' as const,
      price: 1080,
      previousClose: 1070,
      exchangeTimestamp: new Date('2026-10-20T10:00:00Z'),
      fetchedAt: new Date('2026-10-20T10:00:01Z'),
      source: 'fixture',
      historicalCloses: [100, 101, 102, 103, 104, 105],
    };
    const assessment = assessRisk({
      symbol: 'RELIANCE',
      entryPrice: 1000,
      spotPrice: 1080,
    });

    expect(await monitoring.getRiskEpisodeState(strategy.id)).toBeNull();
    await monitoring.recordAssessment(strategy.id, assessment, snapshot);
    await expect(strategies.getDashboard('owner-a')).resolves.toMatchObject({
      snapshots: [
        expect.objectContaining({
          historicalCloses: [100, 101, 102, 103, 104, 105],
        }),
      ],
    });
    await monitoring.saveRiskEpisodeState(strategy.id, {
      episode: 2,
      highestSeverity: 1,
    });
    expect(await monitoring.getRiskEpisodeState(strategy.id)).toEqual({
      episode: 2,
      highestSeverity: 1,
    });
    await db.collection('riskEpisodeStates').doc('corrupt').set({
      episode: 'bad',
      highestSeverity: 1,
    });
    expect(await monitoring.getRiskEpisodeState('corrupt')).toBeNull();
    expect(
      (await db.collection('strategySnapshots').doc(strategy.id).get()).data(),
    ).toMatchObject({ ownerUid: 'owner-a', source: 'fixture' });
  });

  it('records provider failures and rejects alerts without a valid owner', async () => {
    const { monitoring, db } = createStores();
    await monitoring.recordUnavailable(
      'RELIANCE',
      'provider offline',
      new Date('2026-10-20T10:00:00Z'),
    );
    expect(
      (await db.collection('marketDataHealth').doc('RELIANCE').get()).data(),
    ).toMatchObject({ status: 'unavailable', reason: 'provider offline' });

    await expect(
      monitoring.enqueueAlert({
        idempotencyKey: 'missing-strategy-alert',
        strategyId: 'missing',
        symbol: 'RELIANCE',
        kind: 'caution',
        message: 'test',
        price: 1080,
        movementPercent: 8,
        createdAt: new Date(),
      }),
    ).rejects.toThrow('has no valid owner');
  });

  it('deduplicates alerts and retries pending outbox entries until delivered', async () => {
    const { strategies, monitoring, db } = createStores();
    const strategy = await strategies.createForOwner('owner-a', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      active: true,
    });
    await monitoring.listActiveStrategies();
    const alert = {
      idempotencyKey: 'risk:strategy-1:episode-1:caution',
      strategyId: strategy.id,
      symbol: 'RELIANCE' as const,
      kind: 'caution' as const,
      message: 'RELIANCE caution',
      price: 1080,
      movementPercent: 8,
      createdAt: new Date('2026-10-20T10:00:00Z'),
    };

    expect(
      await monitoring.hasDeliveredOrQueuedAlert(alert.idempotencyKey),
    ).toBe(false);
    await monitoring.enqueueAlert(alert);
    await expect(monitoring.enqueueAlert(alert)).resolves.toBeUndefined();
    expect(
      await monitoring.hasDeliveredOrQueuedAlert(alert.idempotencyKey),
    ).toBe(true);
    expect(await monitoring.listPendingAlerts()).toHaveLength(1);

    await monitoring.recordAlertDeliveryFailure(
      alert.idempotencyKey,
      'temporary failure',
      new Date('2026-10-20T10:01:00Z'),
    );
    expect(await monitoring.listPendingAlerts()).toHaveLength(1);
    const alertId = createHash('sha256')
      .update(alert.idempotencyKey)
      .digest('hex');
    expect(
      (await db.collection('alerts').doc(alertId).get()).data(),
    ).toMatchObject({ status: 'pending', lastError: 'temporary failure' });

    await monitoring.markAlertDelivered(
      alert.idempotencyKey,
      new Date('2026-10-20T10:02:00Z'),
    );
    expect(await monitoring.listPendingAlerts()).toHaveLength(0);
  });
});
