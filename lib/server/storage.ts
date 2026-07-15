import { getFileBucket, type StoredObject } from "./bindings";

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  uploadedAt: string | null;
  contentType: string | null;
};

const FOLDER_MARKER = ".vault-folder";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function normalizePath(value: unknown, allowEmpty = true) {
  const text = String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  if (!text && allowEmpty) return "";
  const parts = text.split("/").filter(Boolean);
  if (
    !parts.length ||
    parts.some(
      (part) =>
        part === "." ||
        part === ".." ||
        /[\u0000-\u001f\u007f]/.test(part),
    )
  ) {
    throw new Error("路徑格式不正確");
  }
  return parts.join("/");
}

export function validateName(value: unknown) {
  const name = String(value ?? "").trim();
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name === FOLDER_MARKER ||
    name.length > 180 ||
    /[\\/\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new Error("名稱不可空白，也不能包含斜線或控制字元");
  }
  return name;
}

function joinPath(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name;
}

function folderPrefix(path: string) {
  return path ? `${path}/` : "";
}

function displayFolder(prefix: string, parentPrefix: string): FileEntry | null {
  const relative = prefix.slice(parentPrefix.length).replace(/\/$/, "");
  if (!relative || relative.includes("/")) return null;
  return {
    name: relative,
    path: joinPath(parentPrefix.replace(/\/$/, ""), relative),
    type: "folder",
    size: 0,
    uploadedAt: null,
    contentType: null,
  };
}

function displayFile(object: StoredObject, parentPrefix: string): FileEntry | null {
  const relative = object.key.slice(parentPrefix.length);
  if (!relative || relative === FOLDER_MARKER || relative.includes("/")) return null;
  return {
    name: relative,
    path: joinPath(parentPrefix.replace(/\/$/, ""), relative),
    type: "file",
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
    contentType: object.httpMetadata?.contentType ?? null,
  };
}

export async function listDirectory(pathValue: unknown) {
  const path = normalizePath(pathValue);
  const prefix = folderPrefix(path);
  const result = await getFileBucket().list({ prefix, delimiter: "/" });
  const folders = result.delimitedPrefixes
    .map((item) => displayFolder(item, prefix))
    .filter((item): item is FileEntry => Boolean(item));
  const files = result.objects
    .map((item) => displayFile(item, prefix))
    .filter((item): item is FileEntry => Boolean(item));
  return [...folders, ...files].sort((left, right) => {
    if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-Hant", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export async function createFolder(pathValue: unknown, nameValue: unknown) {
  const path = normalizePath(pathValue);
  const name = validateName(nameValue);
  const target = joinPath(path, name);
  const bucket = getFileBucket();
  const existing = await bucket.list({ prefix: `${target}/`, limit: 1 });
  if (existing.objects.length) throw new Error("同名資料夾已存在");
  if (await bucket.head(target)) throw new Error("同名檔案已存在");
  await bucket.put(`${target}/${FOLDER_MARKER}`, "", {
    customMetadata: { kind: "folder" },
  });
  return target;
}

export async function uploadFiles(
  pathValue: unknown,
  files: File[],
  uploadedBy: string,
) {
  const path = normalizePath(pathValue);
  const bucket = getFileBucket();
  if (!files.length) throw new Error("請選擇至少一個檔案");
  const results: string[] = [];
  for (const file of files) {
    const name = validateName(file.name);
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${name} 超過 25 MB 上傳限制`);
    }
    const key = joinPath(path, name);
    const folderCollision = await bucket.list({ prefix: `${key}/`, limit: 1 });
    if (folderCollision.objects.length) throw new Error(`${name} 與現有資料夾同名`);
    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
      customMetadata: { uploadedBy, originalName: name },
    });
    results.push(key);
  }
  return results;
}

async function listAllKeys(prefix: string) {
  const bucket = getFileBucket();
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function deleteEntry(pathValue: unknown, type: "file" | "folder") {
  const path = normalizePath(pathValue, false);
  const bucket = getFileBucket();
  if (type === "file") {
    if (!(await bucket.head(path))) throw new Error("檔案不存在");
    await bucket.delete(path);
    return;
  }
  const keys = await listAllKeys(`${path}/`);
  if (!keys.length) throw new Error("資料夾不存在");
  for (let index = 0; index < keys.length; index += 500) {
    await bucket.delete(keys.slice(index, index + 500));
  }
}

async function ensureDestinationAvailable(path: string, type: "file" | "folder") {
  const bucket = getFileBucket();
  if (await bucket.head(path)) throw new Error("同名檔案已存在");
  const folder = await bucket.list({ prefix: `${path}/`, limit: 1 });
  if (folder.objects.length) {
    throw new Error(type === "folder" ? "同名資料夾已存在" : "同名資料夾已存在");
  }
}

export async function renameEntry(
  pathValue: unknown,
  nameValue: unknown,
  type: "file" | "folder",
) {
  const path = normalizePath(pathValue, false);
  const name = validateName(nameValue);
  const segments = path.split("/");
  segments.pop();
  const parent = segments.join("/");
  const destination = joinPath(parent, name);
  if (destination === path) return destination;
  await ensureDestinationAvailable(destination, type);

  const bucket = getFileBucket();
  if (type === "file") {
    const source = await bucket.get(path);
    if (!source) throw new Error("檔案不存在");
    await bucket.put(destination, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
    });
    await bucket.delete(path);
    return destination;
  }

  const sourcePrefix = `${path}/`;
  const destinationPrefix = `${destination}/`;
  const keys = await listAllKeys(sourcePrefix);
  if (!keys.length) throw new Error("資料夾不存在");
  for (const key of keys) {
    const source = await bucket.get(key);
    if (!source) continue;
    const newKey = `${destinationPrefix}${key.slice(sourcePrefix.length)}`;
    await bucket.put(newKey, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
    });
  }
  for (let index = 0; index < keys.length; index += 500) {
    await bucket.delete(keys.slice(index, index + 500));
  }
  return destination;
}

export async function getDownload(pathValue: unknown) {
  const path = normalizePath(pathValue, false);
  const object = await getFileBucket().get(path);
  if (!object) throw new Error("檔案不存在");
  return { path, object };
}
