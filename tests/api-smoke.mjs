import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function request(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path}: ${body.error || response.status}`);
  }
  return { response, body };
}

function cookieFrom(response) {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "response should set a session cookie");
  return value.split(";", 1)[0];
}

async function jsonRequest(path, method, body, cookie) {
  return request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    cookie,
  );
}

const suffix = Date.now().toString(36);
const username = `smoke_${suffix}`;
const folder = `_smoke_${suffix}`;
const initialPassword = "SmokeAa123";
const changedPassword = "SmokeBb456";
let adminCookie = "";
let memberCookie = "";
let createdUserId = 0;

try {
  const adminLogin = await jsonRequest("/api/auth/login", "POST", {
    username: "admin",
    password: "Aa123456",
  });
  adminCookie = cookieFrom(adminLogin.response);
  assert.equal(adminLogin.body.user.role, "admin");

  await jsonRequest(
    "/api/users",
    "POST",
    { username, password: initialPassword, role: "member" },
    adminCookie,
  );
  const users = await request("/api/users", {}, adminCookie);
  const created = users.body.users.find((user) => user.username === username);
  assert.ok(created, "new account should be listed");
  createdUserId = created.id;

  const memberLogin = await jsonRequest("/api/auth/login", "POST", {
    username,
    password: initialPassword,
  });
  memberCookie = cookieFrom(memberLogin.response);

  const changed = await jsonRequest(
    "/api/auth/change-password",
    "POST",
    { currentPassword: initialPassword, newPassword: changedPassword },
    memberCookie,
  );
  memberCookie = cookieFrom(changed.response);

  await jsonRequest(
    "/api/files/folder",
    "POST",
    { path: "", name: folder },
    memberCookie,
  );

  const form = new FormData();
  form.append("path", folder);
  form.append("files", new Blob(["VaultDrive smoke test"], { type: "text/plain" }), "hello.txt");
  await request("/api/files/upload", { method: "POST", body: form }, memberCookie);

  const listing = await request(`/api/files?path=${encodeURIComponent(folder)}`, {}, memberCookie);
  assert.equal(listing.body.entries.length, 1);
  assert.equal(listing.body.entries[0].name, "hello.txt");

  await jsonRequest(
    "/api/files/rename",
    "POST",
    { path: `${folder}/hello.txt`, type: "file", name: "renamed.txt" },
    memberCookie,
  );
  const downloaded = await request(
    `/api/files/download?path=${encodeURIComponent(`${folder}/renamed.txt`)}`,
    {},
    memberCookie,
  );
  assert.equal(downloaded.body, "VaultDrive smoke test");

  await jsonRequest(
    "/api/files",
    "DELETE",
    { path: folder, type: "folder" },
    memberCookie,
  );
  const root = await request("/api/files?path=", {}, memberCookie);
  assert.equal(root.body.entries.some((entry) => entry.name === folder), false);

  await jsonRequest("/api/users", "DELETE", { id: createdUserId }, adminCookie);
  createdUserId = 0;
  console.log("VaultDrive API smoke test passed");
} finally {
  if (adminCookie && createdUserId) {
    await jsonRequest("/api/users", "DELETE", { id: createdUserId }, adminCookie).catch(() => {});
  }
  if (memberCookie) {
    await jsonRequest(
      "/api/files",
      "DELETE",
      { path: folder, type: "folder" },
      memberCookie,
    ).catch(() => {});
  }
}
