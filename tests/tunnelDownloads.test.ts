// Verifies first-party tunnel download route helpers.
import { describe, expect, it } from "vitest";
import {
  parseTunnelDownloadPlatform,
  tunnelDownloadPath,
  tunnelGithubDownloadUrl,
  tunnelGithubReleaseUrl,
} from "~/lib/utils/tunnelDownloads";

describe("tunnelDownloads", () => {
  it("builds first-party download paths", () => {
    expect(tunnelDownloadPath("macos-arm")).toBe(
      "/api/download/tunnel/latest?platform=macos-arm",
    );
  });

  it("falls back to macOS Apple Silicon for unknown platforms", () => {
    expect(parseTunnelDownloadPlatform("wat")).toBe("macos-arm");
    expect(parseTunnelDownloadPlatform(null)).toBe("macos-arm");
  });

  it("maps platforms to GitHub release assets", () => {
    expect(tunnelGithubDownloadUrl("macos-arm")).toContain(
      "NIT.Tunnel_0.2.0_aarch64.dmg",
    );
    expect(tunnelGithubDownloadUrl("windows")).toContain(
      "NIT.Tunnel_0.2.0_x64-setup.exe",
    );
  });

  it("returns the latest releases page as the fallback destination", () => {
    expect(tunnelGithubReleaseUrl()).toBe(
      "https://github.com/antsincgame/nit-builder/releases/latest",
    );
  });
});
