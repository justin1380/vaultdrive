"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type UserRole = "admin" | "member";

type SessionUser = {
  id: number;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
};

type FileEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  uploadedAt: string | null;
  contentType: string | null;
};

type ManagedUser = {
  id: number;
  username: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let data: { error?: string } & Partial<T> = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    // A friendly fallback is returned below.
  }
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試");
  return data as T;
}

function formatBytes(size: number) {
  if (!size) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), 3);
  const value = size / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function extension(name: string) {
  const value = name.split(".").pop();
  return value && value !== name ? value.slice(0, 4).toUpperCase() : "FILE";
}

function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card${wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="關閉">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <span>✓</span>
      {message}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-ambient ambient-one" />
      <div className="login-ambient ambient-two" />
      <section className="login-story">
        <div className="brand brand-light">
          <span className="brand-mark">V</span>
          <span>VaultDrive</span>
        </div>
        <div className="story-content">
          <p className="eyebrow">SECURE FILE WORKSPACE</p>
          <h1>你的檔案，<br />安心收好。</h1>
          <p>
            一個清楚、快速且受保護的檔案中心，讓團隊上傳、整理與分享內容更簡單。
          </p>
          <div className="security-points">
            <span><i>✓</i> 登入保護與帳號鎖定</span>
            <span><i>✓</i> 25 MB 單檔安全上傳</span>
            <span><i>✓</i> 管理員帳號控制</span>
          </div>
        </div>
        <p className="story-footnote">Private by design · Built for your team</p>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand brand">
            <span className="brand-mark">V</span>
            <span>VaultDrive</span>
          </div>
          <div className="login-heading">
            <span className="login-icon">↗</span>
            <h2>歡迎回來</h2>
            <p>登入後進入安全檔案中心</p>
          </div>

          <label className="field-label" htmlFor="username">帳號</label>
          <div className="input-wrap">
            <span>◎</span>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="請輸入帳號"
              required
            />
          </div>

          <label className="field-label" htmlFor="password">密碼</label>
          <div className="input-wrap">
            <span>⌾</span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="請輸入密碼"
              required
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
            >
              {showPassword ? "隱藏" : "顯示"}
            </button>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button login-button" disabled={loading}>
            {loading ? "登入中…" : "登入檔案中心"}
            {!loading ? <span>→</span> : null}
          </button>

          <div className="default-account">
            <span className="info-dot">i</span>
            <div>
              <strong>首次登入資訊</strong>
              <p>帳號 admin · 密碼 Aa123456</p>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function PasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("兩次輸入的新密碼不一致");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onChanged();
      onClose();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "修改失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="變更登入密碼"
      description="完成後，其他裝置上的登入狀態會自動失效。"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>目前密碼<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
        <label>新密碼<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <p className="field-help">至少 8 碼，需包含大小寫英文與數字。</p>
        <label>確認新密碼<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button className="primary-button" disabled={loading}>{loading ? "儲存中…" : "儲存新密碼"}</button>
        </div>
      </form>
    </Modal>
  );
}

function UserManager({ currentUser, onClose, notify }: { currentUser: SessionUser; onClose: () => void; notify: (message: string) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ users: ManagedUser[] }>("/api/users");
      setUsers(result.users);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "無法載入帳號");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      setUsername("");
      setPassword("");
      setRole("member");
      setShowCreate(false);
      notify("帳號已建立");
      await loadUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "建立失敗");
    }
  }

  async function updateAccount(id: number, changes: Record<string, unknown>) {
    try {
      await api("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });
      notify("帳號設定已更新");
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失敗");
    }
  }

  async function removeAccount(user: ManagedUser) {
    if (!window.confirm(`確定要刪除帳號「${user.username}」嗎？`)) return;
    try {
      await api("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      notify("帳號已刪除");
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!resetUser) return;
    await updateAccount(resetUser.id, { password: resetPassword });
    setResetUser(null);
    setResetPassword("");
  }

  return (
    <Modal title="帳號管理" description="建立帳號、調整權限與管理登入狀態。" onClose={onClose} wide>
      <div className="user-manager">
        <div className="manager-toolbar">
          <div><strong>{users.length}</strong><span> 個帳號</span></div>
          <button className="primary-button compact" onClick={() => setShowCreate((value) => !value)}>＋ 新增帳號</button>
        </div>
        {showCreate ? (
          <form className="create-user-form" onSubmit={createAccount}>
            <label>帳號<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如：amy.chen" required /></label>
            <label>初始密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 碼" required /></label>
            <label>權限<select value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="member">一般成員</option><option value="admin">管理員</option></select></label>
            <button className="primary-button compact">建立</button>
          </form>
        ) : null}
        {error ? <p className="form-error manager-error">{error}</p> : null}
        <div className="user-list">
          {loading ? <div className="loading-row">正在載入帳號…</div> : users.map((user) => (
            <article className="user-row" key={user.id}>
              <div className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
              <div className="user-identity"><strong>{user.username}</strong><span>{user.id === currentUser.id ? "目前登入" : user.lastLoginAt ? `最近登入 ${formatDate(user.lastLoginAt)}` : "尚未登入"}</span></div>
              <select aria-label={`${user.username} 的權限`} value={user.role} disabled={user.id === currentUser.id} onChange={(event) => void updateAccount(user.id, { role: event.target.value })}><option value="member">一般成員</option><option value="admin">管理員</option></select>
              <button className={`status-pill ${user.active ? "active" : "inactive"}`} disabled={user.id === currentUser.id} onClick={() => void updateAccount(user.id, { active: !user.active })}>{user.active ? "已啟用" : "已停用"}</button>
              <div className="row-actions user-actions">
                <button onClick={() => setResetUser(user)}>重設密碼</button>
                <button className="danger-text" disabled={user.id === currentUser.id} onClick={() => void removeAccount(user)}>刪除</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {resetUser ? (
        <div className="nested-modal">
          <form onSubmit={submitReset}>
            <h3>重設 {resetUser.username} 的密碼</h3>
            <p>此帳號下次登入後會收到變更密碼提醒。</p>
            <input autoFocus type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="輸入新密碼" required />
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setResetUser(null)}>取消</button><button className="primary-button">重設密碼</button></div>
          </form>
        </div>
      ) : null}
    </Modal>
  );
}

function FileManager({ user, onLogout, onUserUpdate }: { user: SessionUser; onLogout: () => void; onUserUpdate: (user: SessionUser) => void }) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameEntry, setRenameEntry] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ entries: FileEntry[] }>(`/api/files?path=${encodeURIComponent(path)}`);
      setEntries(result.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "無法載入檔案");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function upload(selected: File[]) {
    if (!selected.length) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("path", path);
      selected.forEach((file) => form.append("files", file));
      await api("/api/files/upload", { method: "POST", body: form });
      notify(`已上傳 ${selected.length} 個檔案`);
      await loadEntries();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上傳失敗");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/files/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, name: folderName }),
      });
      setFolderOpen(false);
      setFolderName("");
      notify("資料夾已建立");
      await loadEntries();
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "建立失敗");
    }
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!renameEntry) return;
    try {
      await api("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: renameEntry.path, type: renameEntry.type, name: renameName }),
      });
      setRenameEntry(null);
      notify("名稱已更新");
      await loadEntries();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "重新命名失敗");
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    try {
      await api("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleteTarget.path, type: deleteTarget.type }),
      });
      setDeleteTarget(null);
      notify(deleteTarget.type === "folder" ? "資料夾已刪除" : "檔案已刪除");
      await loadEntries();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    }
  }

  const breadcrumbs = path ? path.split("/") : [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">V</span><span>VaultDrive</span></div>
        <nav className="side-nav" aria-label="主要導覽">
          <button className="active" onClick={() => setPath("")}><span>▰</span>所有檔案</button>
          <button onClick={() => fileInput.current?.click()}><span>↑</span>上傳檔案</button>
          <button onClick={() => setFolderOpen(true)}><span>＋</span>新增資料夾</button>
        </nav>
        <div className="sidebar-account">
          {user.role === "admin" ? <button onClick={() => setUsersOpen(true)}><span>♙</span>帳號管理</button> : null}
          <button onClick={() => setPasswordOpen(true)}><span>⚙</span>變更密碼</button>
        </div>
        <div className="storage-note"><span>安全儲存空間</span><div><i /></div><small>檔案均受登入保護</small></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-brand brand"><span className="brand-mark">V</span><span>VaultDrive</span></div>
          <div className="topbar-user">
            <span className="connection-state"><i />安全連線</span>
            <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <div><strong>{user.username}</strong><small>{user.role === "admin" ? "管理員" : "一般成員"}</small></div>
            <button className="logout-button" onClick={onLogout}>登出</button>
          </div>
        </header>

        <div className="workspace-content">
          {user.mustChangePassword ? (
            <button className="password-banner" onClick={() => setPasswordOpen(true)}>
              <span>!</span><div><strong>請更換預設密碼</strong><p>為了帳號安全，建議完成首次登入後立即設定新密碼。</p></div><b>立即設定 →</b>
            </button>
          ) : null}

          <div className="content-heading">
            <div><p className="eyebrow dark">FILE WORKSPACE</p><h1>{path ? breadcrumbs.at(-1) : "所有檔案"}</h1><p>{path ? "瀏覽這個資料夾中的內容" : "管理、整理並安全存取你的檔案"}</p></div>
            <div className="heading-actions"><button className="secondary-button" onClick={() => setFolderOpen(true)}>＋ 新增資料夾</button><button className="primary-button" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? "上傳中…" : "↑ 上傳檔案"}</button></div>
          </div>

          <nav className="breadcrumbs" aria-label="檔案路徑">
            <button onClick={() => setPath("")}>首頁</button>
            {breadcrumbs.map((item, index) => (
              <span key={`${item}-${index}`}>／<button onClick={() => setPath(breadcrumbs.slice(0, index + 1).join("/"))}>{item}</button></span>
            ))}
          </nav>

          <div
            className={`drop-zone${dragging ? " dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}
          >
            <input ref={fileInput} type="file" hidden multiple onChange={(event) => void upload(Array.from(event.target.files || []))} />
            {dragging ? <div className="drop-message"><span>↓</span><strong>放開以上傳檔案</strong></div> : null}
            {error ? <div className="inline-error"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div> : null}
            <div className="file-table-heading"><span>名稱</span><span>大小</span><span>更新時間</span><span>操作</span></div>
            <div className="file-list">
              {loading ? (
                <div className="empty-state loading-state"><div className="spinner" /><strong>正在取得檔案…</strong></div>
              ) : entries.length ? entries.map((entry) => (
                <article className="file-row" key={entry.path} onDoubleClick={() => entry.type === "folder" && setPath(entry.path)}>
                  <button className="file-name" onClick={() => entry.type === "folder" && setPath(entry.path)}>
                    {entry.type === "folder" ? <span className="folder-icon"><i /></span> : <span className="file-icon">{extension(entry.name)}</span>}
                    <div><strong>{entry.name}</strong><small>{entry.type === "folder" ? "資料夾" : entry.contentType || "檔案"}</small></div>
                  </button>
                  <span className="file-meta">{entry.type === "folder" ? "—" : formatBytes(entry.size)}</span>
                  <span className="file-meta">{formatDate(entry.uploadedAt)}</span>
                  <div className="row-actions">
                    {entry.type === "file" ? <a href={`/api/files/download?path=${encodeURIComponent(entry.path)}`} title="下載" aria-label={`下載 ${entry.name}`}>↓</a> : <button onClick={() => setPath(entry.path)} title="開啟" aria-label={`開啟 ${entry.name}`}>→</button>}
                    <button onClick={() => { setRenameEntry(entry); setRenameName(entry.name); }} title="重新命名" aria-label={`重新命名 ${entry.name}`}>✎</button>
                    <button className="danger-text" onClick={() => setDeleteTarget(entry)} title="刪除" aria-label={`刪除 ${entry.name}`}>×</button>
                  </div>
                </article>
              )) : (
                <div className="empty-state"><span className="empty-folder"><i /></span><strong>這裡還沒有檔案</strong><p>拖曳檔案到此處，或按下上傳檔案開始使用。</p><button className="primary-button compact" onClick={() => fileInput.current?.click()}>↑ 選擇檔案</button></div>
              )}
            </div>
          </div>
          <p className="upload-limit">支援多檔上傳 · 單一檔案上限 25 MB</p>
        </div>
      </section>

      {folderOpen ? <Modal title="新增資料夾" description="在目前位置建立一個新資料夾。" onClose={() => setFolderOpen(false)}><form className="modal-form" onSubmit={createFolder}><label>資料夾名稱<input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="例如：專案文件" required /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFolderOpen(false)}>取消</button><button className="primary-button">建立資料夾</button></div></form></Modal> : null}
      {renameEntry ? <Modal title="重新命名" description={`更新「${renameEntry.name}」的名稱。`} onClose={() => setRenameEntry(null)}><form className="modal-form" onSubmit={rename}><label>新名稱<input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} required /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRenameEntry(null)}>取消</button><button className="primary-button">儲存名稱</button></div></form></Modal> : null}
      {deleteTarget ? <Modal title={`刪除${deleteTarget.type === "folder" ? "資料夾" : "檔案"}`} description={deleteTarget.type === "folder" ? "資料夾內的所有內容也會一併刪除。" : "刪除後無法復原，請確認後再繼續。"} onClose={() => setDeleteTarget(null)}><div className="delete-confirm"><span>{deleteTarget.type === "folder" ? "▰" : extension(deleteTarget.name)}</span><strong>{deleteTarget.name}</strong></div><div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>取消</button><button className="danger-button" onClick={() => void remove()}>確認刪除</button></div></Modal> : null}
      {passwordOpen ? <PasswordModal onClose={() => setPasswordOpen(false)} onChanged={() => { onUserUpdate({ ...user, mustChangePassword: false }); notify("密碼已更新"); }} /> : null}
      {usersOpen ? <UserManager currentUser={user} onClose={() => setUsersOpen(false)} notify={notify} /> : null}
      {toast ? <Toast message={toast} /> : null}
    </main>
  );
}

export function VaultDriveApp() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ authenticated: boolean; user?: SessionUser }>("/api/auth/session")
      .then((session) => setUser(session.authenticated ? session.user || null : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (loading) {
    return <main className="boot-screen"><div className="brand"><span className="brand-mark">V</span><span>VaultDrive</span></div><div className="spinner" /><p>正在開啟安全檔案中心…</p></main>;
  }
  if (!user) return <LoginScreen onLogin={setUser} />;
  return <FileManager user={user} onLogout={() => void logout()} onUserUpdate={setUser} />;
}
