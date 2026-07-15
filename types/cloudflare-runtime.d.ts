declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  prepare(query: string): unknown;
}
