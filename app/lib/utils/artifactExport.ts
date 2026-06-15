import type {
  PhpSqliteArtifact,
  PhpSqliteProjectFile,
} from "~/lib/services/phpSqliteArtifactBuilder";

const MANIFEST_RE =
  /<script\b[^>]*id=["']nit-artifact-manifest["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;

function isPhpSqliteArtifact(value: unknown): value is PhpSqliteArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<PhpSqliteArtifact>;
  return (
    artifact.kind === "php-sqlite-app" &&
    artifact.version === 1 &&
    Array.isArray(artifact.files) &&
    artifact.files.every(
      (file) =>
        file &&
        typeof file === "object" &&
        typeof (file as PhpSqliteProjectFile).path === "string" &&
        typeof (file as PhpSqliteProjectFile).content === "string",
    )
  );
}

function htmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractPhpSqliteArtifact(html: string): PhpSqliteArtifact | null {
  // Дешёвый guard: эта функция зовётся на КАЖДОМ кадре стрима в превью. Пока
  // в HTML нет манифеста (а во время стрима его ещё нет), `String.includes`
  // O(n) с ранним выходом дешевле, чем lazy-регэкс `[\s\S]*?`, который без
  // `</script>` сканирует весь растущий документ и падает каждый кадр.
  if (!html.includes("nit-artifact-manifest")) return null;
  const match = html.match(MANIFEST_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(htmlDecode(match[1].trim()));
    return isPhpSqliteArtifact(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isPhpSqliteArtifactHtml(html: string): boolean {
  return extractPhpSqliteArtifact(html) !== null;
}

function sanitizeZipPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter((part) => part && part !== "." && part !== "..");
  return parts.join("/") || "file.txt";
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU16(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number): void {
  out.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function concatParts(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function blobPart(part: Uint8Array): BlobPart {
  const copy = new Uint8Array(part.byteLength);
  copy.set(part);
  return copy.buffer as ArrayBuffer;
}

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

export function buildStoredZipBlob(
  files: PhpSqliteProjectFile[],
  now = new Date(),
): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const path = sanitizeZipPath(file.path);
    const nameBytes = encoder.encode(path);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader: number[] = [];

    writeU32(localHeader, 0x04034b50);
    writeU16(localHeader, 20);
    writeU16(localHeader, 0x0800); // UTF-8 file names
    writeU16(localHeader, 0); // store, no compression
    writeU16(localHeader, time);
    writeU16(localHeader, date);
    writeU32(localHeader, crc);
    writeU32(localHeader, contentBytes.length);
    writeU32(localHeader, contentBytes.length);
    writeU16(localHeader, nameBytes.length);
    writeU16(localHeader, 0);

    const localRecord = concatParts([bytes(localHeader), nameBytes, contentBytes]);
    localParts.push(localRecord);

    const centralHeader: number[] = [];
    writeU32(centralHeader, 0x02014b50);
    writeU16(centralHeader, 20);
    writeU16(centralHeader, 20);
    writeU16(centralHeader, 0x0800);
    writeU16(centralHeader, 0);
    writeU16(centralHeader, time);
    writeU16(centralHeader, date);
    writeU32(centralHeader, crc);
    writeU32(centralHeader, contentBytes.length);
    writeU32(centralHeader, contentBytes.length);
    writeU16(centralHeader, nameBytes.length);
    writeU16(centralHeader, 0);
    writeU16(centralHeader, 0);
    writeU16(centralHeader, 0);
    writeU16(centralHeader, 0);
    writeU32(centralHeader, 0);
    writeU32(centralHeader, offset);
    centralParts.push(concatParts([bytes(centralHeader), nameBytes]));

    offset += localRecord.length;
  }

  const centralStart = offset;
  const central = concatParts(centralParts);
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, central.length);
  writeU32(end, centralStart);
  writeU16(end, 0);

  return new Blob([...localParts, central, bytes(end)].map(blobPart), {
    type: "application/zip",
  });
}

export function artifactDownloadName(artifact: PhpSqliteArtifact): string {
  const safeBase = artifact.files
    .find((file) => file.path === "README.md")
    ?.content.match(/^#\s+(.+)$/m)?.[1]
    ?.toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `nit-${safeBase || "php-sqlite-app"}-${Date.now()}.zip`;
}
