import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const description = "為團隊打造的安全檔案上傳、下載與帳號管理中心。";

  return {
    metadataBase: base,
    title: {
      default: "VaultDrive｜安全檔案中心",
      template: "%s｜VaultDrive",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "VaultDrive｜你的檔案，安心收好。",
      description,
      type: "website",
      locale: "zh_TW",
      images: [
        {
          url: new URL("/og.png", base).toString(),
          width: 1731,
          height: 909,
          alt: "VaultDrive 安全檔案中心",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "VaultDrive｜你的檔案，安心收好。",
      description,
      images: [new URL("/og.png", base).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
