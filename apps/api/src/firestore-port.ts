export interface DocumentSnapshotPort {
  readonly id: string;
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface QuerySnapshotPort {
  readonly docs: DocumentSnapshotPort[];
  readonly empty: boolean;
}

export interface DocumentReferencePort {
  readonly id: string;
  get(): Promise<DocumentSnapshotPort>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  create(data: Record<string, unknown>): Promise<unknown>;
}

export interface QueryPort {
  where(field: string, operator: '==', value: unknown): QueryPort;
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryPort;
  limit(count: number): QueryPort;
  get(): Promise<QuerySnapshotPort>;
}

export interface CollectionReferencePort extends QueryPort {
  doc(id?: string): DocumentReferencePort;
  add(data: Record<string, unknown>): Promise<DocumentReferencePort>;
}

export interface FirestorePort {
  collection(name: string): CollectionReferencePort;
}
