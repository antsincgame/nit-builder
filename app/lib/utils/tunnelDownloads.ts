// Centralizes public NIT Tunnel download URLs behind first-party routes.
export type TunnelDownloadPlatform =
  | "windows"
  | "macos-arm"
  | "macos-intel"
  | "linux"
  | "linux-deb";

export const TUNNEL_DOWNLOADS: Record<
  TunnelDownloadPlatform,
  { filename: string; label: string }
> = {
  windows: {
    filename: "NIT.Tunnel_0.2.3_x64-setup.exe",
    label: "Windows",
  },
  "macos-arm": {
    filename: "NIT.Tunnel_0.2.3_aarch64.dmg",
    label: "macOS Apple Silicon",
  },
  "macos-intel": {
    filename: "NIT.Tunnel_0.2.3_x64.dmg",
    label: "macOS Intel",
  },
  linux: {
    // Фактическое имя из релиза tunnel-desktop-v0.2.3: Tauri бандлит
    // AppImage/deb по productName ("NIT Tunnel" → NIT.Tunnel), а не lowercase.
    filename: "NIT.Tunnel_0.2.3_amd64.AppImage",
    label: "Linux AppImage",
  },
  "linux-deb": {
    filename: "NIT.Tunnel_0.2.3_amd64.deb",
    label: "Linux Debian/Ubuntu",
  },
};

export const DEFAULT_TUNNEL_PLATFORM: TunnelDownloadPlatform = "macos-arm";

export function tunnelDownloadPath(platform: TunnelDownloadPlatform): string {
  return `/api/download/tunnel/latest?platform=${encodeURIComponent(platform)}`;
}

export function tunnelGithubDownloadUrl(platform: TunnelDownloadPlatform): string {
  const asset = TUNNEL_DOWNLOADS[platform] ?? TUNNEL_DOWNLOADS[DEFAULT_TUNNEL_PLATFORM];
  return `https://github.com/antsincgame/nit-builder/releases/latest/download/${asset.filename}`;
}

export function tunnelGithubReleaseUrl(): string {
  // Всегда последний опубликованный релиз — конкретный тег (tunnel-v0.1.0)
  // вёл на пустой CLI-пререлиз без единого ассета.
  return "https://github.com/antsincgame/nit-builder/releases/latest";
}

export function parseTunnelDownloadPlatform(
  value: string | null,
): TunnelDownloadPlatform {
  if (value && value in TUNNEL_DOWNLOADS) return value as TunnelDownloadPlatform;
  return DEFAULT_TUNNEL_PLATFORM;
}
