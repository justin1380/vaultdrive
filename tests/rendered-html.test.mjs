import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the VaultDrive application shell", async () => {
  const [page, layout, client] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/vault-drive-app.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /VaultDrive｜安全檔案中心/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(client, /歡迎回來/);
  assert.match(client, /正在開啟安全檔案中心/);
  assert.doesNotMatch(`${page}${layout}${client}`, /codex-preview|Your site is taking shape/i);
  await access(new URL("../dist/server/index.js", import.meta.url));
});

test("declares durable account and file storage", async () => {
  const [hosting, schema, auth, storage] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(schema, /sqliteTable\("users"/);
  assert.match(schema, /sqliteTable\("sessions"/);
  assert.match(auth, /PBKDF2/);
  assert.match(storage, /MAX_UPLOAD_BYTES = 25 \* 1024 \* 1024/);
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_vaultdrive_auth.sql", import.meta.url));
});
