export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 60 * 1024 * 1024;
export const MAX_ARCHIVE_FILES = 30;
export const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.bmp,.avif,.heic,.heif,.zip,.rar,.docx";
export const supportedExtensions = new Set(UPLOAD_ACCEPT.split(",").map((ext) => ext.slice(1)));
export const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export function safeArchiveName(name: string) {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").includes("..") || /[\x00-\x1f]/.test(normalized)) {
    throw new Error("This archive contains an unsafe file path.");
  }
  return normalized.split("/").pop() || "";
}

export function checkEntry(name: string, size: number, total: number, count: number) {
  safeArchiveName(name);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_UPLOAD_BYTES) throw new Error("Each extracted file must be at most 20 MB.");
  if (total + size > MAX_EXPANDED_BYTES || count > MAX_ARCHIVE_FILES) throw new Error("Archives may contain at most 30 files and 60 MB of unpacked data.");
}
