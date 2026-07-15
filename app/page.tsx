import type { Metadata } from "next";
import { VaultDriveApp } from "./vault-drive-app";

export const metadata: Metadata = {
  title: "VaultDrive｜安全檔案中心",
  description: "登入後即可安全上傳、整理與下載團隊檔案。",
};

export default function Home() {
  return <VaultDriveApp />;
}
