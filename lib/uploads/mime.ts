import { extensionOf } from "./policy";

export const uploadMimes: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp", avif: "image/avif",
  heic: "image/heic", heif: "image/heif", zip: "application/zip", rar: "application/vnd.rar",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const mimeForUpload = (name: string) => uploadMimes[extensionOf(name)];
export function storageOrigin(projectUrl: string) {
  const url = new URL(projectUrl);
  if (/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  return url.origin;
}
