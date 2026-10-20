import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { extensionOf, MAX_UPLOAD_BYTES } from "./policy";
import { unpackArchive, type UploadPart } from "./archives";

export type NormalizedUpload = UploadPart & { mime: string; note?: string };
const PIXELS = 32_000_000;

/** Convert less portable images to JPEG or multipage PDF, compatible with storage and OCR. */
export async function normalizeUpload(file: UploadPart): Promise<NormalizedUpload> {
  const ext = extensionOf(file.name);
  if (!file.bytes.length || file.bytes.length > MAX_UPLOAD_BYTES) throw new Error("Files must be between 1 byte and 20 MB.");
  if (ext === "pdf") {
    if (!file.bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("This file is not a PDF.");
    return { ...file, mime: "application/pdf" };
  }
  if (ext === "docx") {
    if (file.bytes.subarray(0, 2).toString() !== "PK") throw new Error("This file is not a Word document.");
    await unpackArchive(file.bytes, "zip", true);
    return { ...file, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  let bytes = file.bytes;
  let conversionNote: string | undefined;
  if (ext === "heic" || ext === "heif") {
    const { default: decode } = await import("heic-decode");
    const images = await decode.all({ buffer: bytes });
    try {
      const image = images[0];
      if (!image || !image.width || !image.height || image.width * image.height > PIXELS) throw new Error("Image dimensions are too large.");
      const decoded = await image.decode();
      bytes = await sharp(decoded.data, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }).jpeg({ quality: 95 }).toBuffer();
      conversionNote = images.length > 1 ? "HEIC main image converted to JPEG; upload additional images separately." : "HEIC image converted to JPEG.";
    } finally { images.dispose(); }
  } else if (ext === "bmp") {
    if (bytes.length < 54 || bytes.subarray(0, 2).toString() !== "BM") throw new Error("Invalid BMP image.");
    const width = Math.abs(bytes.readInt32LE(18)), height = Math.abs(bytes.readInt32LE(22));
    if (!width || !height || width * height > PIXELS) throw new Error("Image dimensions are too large.");
    const { decode } = await import("bmp-js");
    const bmp = decode(bytes);
    // bmp-js outputs ABGR; sharp expects RGBA.
    for (let i = 0; i < bmp.data.length; i += 4) {
      const r = bmp.data[i + 3], g = bmp.data[i + 2], b = bmp.data[i + 1];
      bmp.data[i] = r; bmp.data[i + 1] = g; bmp.data[i + 2] = b; bmp.data[i + 3] = 255;
    }
    bytes = await sharp(bmp.data, { raw: { width: bmp.width, height: bmp.height, channels: 4 } }).png().toBuffer();
  }
  const metadata = await sharp(bytes, { limitInputPixels: PIXELS }).metadata();
  if (!metadata.format || !["jpeg", "png", "webp", "gif", "heif", "tiff"].includes(metadata.format)) throw new Error("Unsupported image format.");
  const pages = metadata.format === "tiff" ? metadata.pages ?? 1 : 1;
  if (pages > 30) throw new Error("TIFF files may contain at most 30 pages.");
  if (pages > 1) {
    const pdf = await PDFDocument.create();
    for (let page = 0; page < pages; page++) {
      const jpg = await sharp(bytes, { page, pages: 1, limitInputPixels: PIXELS }).rotate().resize({ width: 2600, height: 3600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fff" }).jpeg({ quality: 92 }).toBuffer();
      const image = await pdf.embedJpg(jpg);
      const sheet = pdf.addPage([image.width, image.height]);
      sheet.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    return { name: file.name + ".pdf", bytes: Buffer.from(await pdf.save()), mime: "application/pdf", note: "All TIFF pages converted to PDF." };
  }
  if (["jpeg", "png", "webp"].includes(metadata.format)) return {
    name: bytes === file.bytes ? file.name : file.name + (metadata.format === "jpeg" ? ".jpg" : ".png"),
    bytes, mime: "image/" + metadata.format,
    ...(bytes !== file.bytes ? { note: conversionNote ?? "Image converted for OCR." } : {}),
  };
  const converted = await sharp(bytes, { limitInputPixels: PIXELS }).rotate().flatten({ background: "#fff" }).jpeg({ quality: 95 }).toBuffer();
  return { name: file.name + ".jpg", bytes: converted, mime: "image/jpeg", note: metadata.format === "gif" ? "GIF first frame converted to JPEG." : "Image converted to JPEG for OCR." };
}
