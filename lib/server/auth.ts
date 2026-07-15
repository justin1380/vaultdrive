import { getDatabase } from "./bindings";

const SESSION_COOKIE = "vault_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 210_000;
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "Aa123456";

export type UserRole = "admin" | "member";

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: UserRole;
  active: number;
  must_change_password: number;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};

export type SessionUser = {
  id: number;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
};

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(hash));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt).buffer,
      iterations,
    },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function makePassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derivePassword(password, salt, PASSWORD_ITERATIONS),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

async function verifyPassword(password: string, user: UserRow) {
  const actual = await derivePassword(
    password,
    base64ToBytes(user.password_salt),
    user.password_iterations,
  );
  const left = new TextEncoder().encode(actual);
  const right = new TextEncoder().encode(user.password_hash);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function validateUsername(username: string) {
  return /^[A-Za-z0-9._-]{3,32}$/.test(username);
}

export function validatePassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

export async function ensureAuthDatabase() {
  const db = getDatabase();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at)",
    ),
  ]);

  const existing = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(DEFAULT_USERNAME)
    .first<{ id: number }>();
  if (!existing) {
    const password = await makePassword(DEFAULT_PASSWORD);
    const now = new Date().toISOString();
    await db
      .prepare(`INSERT OR IGNORE INTO users
        (username, password_hash, password_salt, password_iterations, role, active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)`)
      .bind(
        DEFAULT_USERNAME,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now,
      )
      .run();
  }
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const item of cookies.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return null;
}

function sessionCookie(token: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function getSessionUser(request: Request) {
  await ensureAuthDatabase();
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await getDatabase()
    .prepare(`SELECT u.id, u.username, u.role, u.must_change_password
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`)
    .bind(tokenHash, now)
    .first<{
      id: number;
      username: string;
      role: UserRole;
      must_change_password: number;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChangePassword: Boolean(row.must_change_password),
  } satisfies SessionUser;
}

export async function authenticate(username: string, password: string) {
  await ensureAuthDatabase();
  const db = getDatabase();
  const user = await db
    .prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first<UserRow>();
  if (!user || !user.active) return null;

  const now = new Date();
  if (user.locked_until && new Date(user.locked_until) > now) {
    throw new Error("登入嘗試過多，請稍後再試");
  }

  if (!(await verifyPassword(password, user))) {
    const failedAttempts = user.failed_attempts + 1;
    const lockedUntil =
      failedAttempts >= 5
        ? new Date(now.getTime() + 15 * 60 * 1000).toISOString()
        : null;
    await db
      .prepare(
        "UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?",
      )
      .bind(failedAttempts >= 5 ? 0 : failedAttempts, lockedUntil, now.toISOString(), user.id)
      .run();
    return null;
  }

  await db
    .prepare(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(now.toISOString(), now.toISOString(), user.id)
    .run();
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
  } satisfies SessionUser;
}

export async function createSession(userId: number, request: Request) {
  const db = getDatabase();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()),
    db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(tokenHash, userId, expiresAt.toISOString(), now.toISOString()),
  ]);
  return sessionCookie(token, request, SESSION_DAYS * 24 * 60 * 60);
}

export async function destroySession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await getDatabase()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256(token))
      .run();
  }
  return sessionCookie("", request, 0);
}

export async function changeOwnPassword(
  user: SessionUser,
  currentPassword: string,
  newPassword: string,
  request: Request,
) {
  const db = getDatabase();
  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(user.id)
    .first<UserRow>();
  if (!row || !(await verifyPassword(currentPassword, row))) {
    throw new Error("目前密碼不正確");
  }
  if (!validatePassword(newPassword)) {
    throw new Error("新密碼需至少 8 碼，並包含大小寫英文與數字");
  }
  const password = await makePassword(newPassword);
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(`UPDATE users SET password_hash = ?, password_salt = ?,
        password_iterations = ?, must_change_password = 0, updated_at = ? WHERE id = ?`)
      .bind(password.hash, password.salt, password.iterations, now, user.id),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
  ]);
  return createSession(user.id, request);
}

export async function listUsers() {
  await ensureAuthDatabase();
  const result = await getDatabase()
    .prepare(`SELECT id, username, role, active, must_change_password, created_at, last_login_at
      FROM users ORDER BY username COLLATE NOCASE`)
    .all<{
      id: number;
      username: string;
      role: UserRole;
      active: number;
      must_change_password: number;
      created_at: string;
      last_login_at: string | null;
    }>();
  return result.results.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    active: Boolean(user.active),
    mustChangePassword: Boolean(user.must_change_password),
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  }));
}

export async function createUserAccount(
  username: string,
  passwordValue: string,
  role: UserRole,
) {
  if (!validateUsername(username)) {
    throw new Error("帳號需為 3–32 碼，可使用英文、數字、句點、底線與連字號");
  }
  if (!validatePassword(passwordValue)) {
    throw new Error("密碼需至少 8 碼，並包含大小寫英文與數字");
  }
  const password = await makePassword(passwordValue);
  const now = new Date().toISOString();
  try {
    await getDatabase()
      .prepare(`INSERT INTO users
        (username, password_hash, password_salt, password_iterations, role, active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`)
      .bind(username, password.hash, password.salt, password.iterations, role, now, now)
      .run();
  } catch {
    throw new Error("這個帳號已經存在");
  }
}

export async function updateUserAccount(input: {
  id: number;
  active?: boolean;
  role?: UserRole;
  password?: string;
}) {
  const db = getDatabase();
  const target = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(input.id)
    .first<UserRow>();
  if (!target) throw new Error("找不到帳號");

  if (target.role === "admin" && (input.active === false || input.role === "member")) {
    const count = await db
      .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1")
      .first<{ total: number }>();
    if ((count?.total ?? 0) <= 1) throw new Error("至少要保留一個啟用中的管理員");
  }

  const role = input.role ?? target.role;
  const active = input.active ?? Boolean(target.active);
  const now = new Date().toISOString();
  if (input.password) {
    if (!validatePassword(input.password)) {
      throw new Error("密碼需至少 8 碼，並包含大小寫英文與數字");
    }
    const password = await makePassword(input.password);
    await db.batch([
      db
        .prepare(`UPDATE users SET role = ?, active = ?, password_hash = ?,
          password_salt = ?, password_iterations = ?, must_change_password = 1,
          updated_at = ? WHERE id = ?`)
        .bind(
          role,
          active ? 1 : 0,
          password.hash,
          password.salt,
          password.iterations,
          now,
          input.id,
        ),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(input.id),
    ]);
  } else {
    await db
      .prepare("UPDATE users SET role = ?, active = ?, updated_at = ? WHERE id = ?")
      .bind(role, active ? 1 : 0, now, input.id)
      .run();
    if (!active) {
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(input.id).run();
    }
  }
}

export async function deleteUserAccount(id: number, currentUserId: number) {
  if (id === currentUserId) throw new Error("不能刪除目前登入的帳號");
  const db = getDatabase();
  const target = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  if (!target) throw new Error("找不到帳號");
  if (target.role === "admin" && target.active) {
    const count = await db
      .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1")
      .first<{ total: number }>();
    if ((count?.total ?? 0) <= 1) throw new Error("至少要保留一個啟用中的管理員");
  }
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
}

export async function audit(user: SessionUser, action: string, target?: string) {
  await getDatabase()
    .prepare(
      "INSERT INTO audit_logs (user_id, username, action, target, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(user.id, user.username, action, target ?? null, new Date().toISOString())
    .run();
}
