import { env } from "cloudflare:workers";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface StoredObject {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  customMetadata?: Record<string, string>;
}

export interface StoredObjectBody extends StoredObject {
  body: ReadableStream<Uint8Array>;
  writeHttpMetadata(headers: Headers): void;
}

export interface FileBucket {
  list(options?: {
    prefix?: string;
    delimiter?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    objects: StoredObject[];
    delimitedPrefixes: string[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<StoredObjectBody | null>;
  head(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | string,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

type AppBindings = {
  DB?: D1Database;
  FILES?: FileBucket;
};

function bindings() {
  return env as unknown as AppBindings;
}

export function getDatabase() {
  const database = bindings().DB;
  if (!database) throw new Error("資料庫尚未連線");
  return database;
}

export function getFileBucket() {
  const bucket = bindings().FILES;
  if (!bucket) throw new Error("檔案儲存空間尚未連線");
  return bucket;
}
