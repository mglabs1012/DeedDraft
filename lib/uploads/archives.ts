import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { createExtractorFromData } from "node-unrar-js";
import { checkEntry, extensionOf, MAX_ARCHIVE_FILES, MAX_EXPANDED_BYTES, MAX_UPLOAD_BYTES, safeArchiveName, supportedExtensions } from "./policy";

export type UploadPart = { name: string; bytes: Buffer };

/** Memory-only extraction. Never materialize untrusted paths on the filesystem. */
export async function unpackArchive(bytes: Buffer, extension: string, documentPackage = false): Promise<{ files: UploadPart[]; skipped: string[] }> {
  const files: UploadPart[] = [];
  const skipped: string[] = [];
  let total = 0;
  let count = 0;
  let hasDocumentXml = false;
  const allowed = (name: string, size: number) => {
    ++count;
    if (documentPackage && count > 500) throw new Error("This Word document contains too many package entries.");
    checkEntry(name, size, total, documentPackage ? 1 : count);
    total += size;
    const ext = extensionOf(name);
    if (documentPackage) {
      if (name === "word/document.xml") hasDocumentXml = true;
      return true; // Validate EVERY inflated entry before handing the package to the Word parser.
    }
    if (ext === "zip" || ext === "rar") throw new Error("Nested archives are not supported. Upload the inner ZIP or RAR separately.");
    if (!supportedExtensions.has(ext)) { skipped.push(safeArchiveName(name)); return false; }
    return true;
  };
  if (extension === "rar") {
    if (bytes.subarray(0, 4).toString("ascii") !== "Rar!") throw new Error("The file is not a valid RAR archive.");
    const extractor = await createExtractorFromData({ data: Uint8Array.from(bytes).buffer });
    // Fully consume header iterators (the WASM library releases allocations at iterator end).
    const listing = extractor.getFileList();
    const selected = new Set<string>();
    for (const header of listing.fileHeaders) {
      safeArchiveName(header.name);
      if (header.flags.encrypted) throw new Error("Password-protected archives are not supported.");
      if (!header.flags.directory && allowed(header.name, header.unpSize)) selected.add(header.name);
    }
    for (const file of extractor.extract({ files: (header) => selected.has(header.name) }).files) {
      if (file.extraction) {
        if (file.extraction.byteLength !== file.fileHeader.unpSize || file.extraction.byteLength > MAX_UPLOAD_BYTES) throw new Error("Invalid archive file size.");
        files.push({ name: safeArchiveName(file.fileHeader.name), bytes: Buffer.from(file.extraction) });
      }
    }
  } else {
    await new Promise<void>((resolve, reject) => {
      let zip: ZipFile | undefined;
      let settled = false;
      const fail = (error: unknown) => { if (settled) return; settled = true; zip?.close(); reject(error); };
      fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, archive) => {
        if (error || !archive) return fail(new Error("The ZIP archive could not be opened."));
        zip = archive;
        if (zip.entryCount > (documentPackage ? 600 : MAX_ARCHIVE_FILES + 100)) return fail(new Error("Too many entries in this archive."));
        zip.on("error", fail);
        zip.on("end", () => { if (!settled) { settled = true; resolve(); } });
        zip.on("entry", (entry: Entry) => {
          try {
            safeArchiveName(entry.fileName);
            if (entry.generalPurposeBitFlag & 1) throw new Error("Password-protected archives are not supported.");
            if (/\/$/.test(entry.fileName)) return zip!.readEntry();
            // Reject symlinks and other non-regular Unix entries.
            const kind = (entry.externalFileAttributes >>> 16) & 0xf000;
            if (kind && kind !== 0x8000) throw new Error("Archive links and special files are not supported.");
            if (!allowed(entry.fileName, entry.uncompressedSize)) return zip!.readEntry();
            zip!.openReadStream(entry, (streamError, stream) => {
              if (streamError || !stream) return fail(new Error("An archive entry could not be read."));
              const chunks: Buffer[] = [];
              let length = 0;
              stream.on("error", fail);
              stream.on("data", (chunk: Buffer) => {
                length += chunk.length;
                if (length > MAX_UPLOAD_BYTES || length > MAX_EXPANDED_BYTES) { stream.destroy(); fail(new Error("Expanded file exceeds the upload limit.")); return; }
                if (!documentPackage) chunks.push(chunk);
              });
              stream.on("end", () => {
                if (settled) return;
                if (length !== entry.uncompressedSize) return fail(new Error("Archive size mismatch."));
                if (!documentPackage) files.push({ name: safeArchiveName(entry.fileName), bytes: Buffer.concat(chunks) });
                zip!.readEntry();
              });
            });
          } catch (error) { fail(error); }
        });
        zip.readEntry();
      });
    });
  }
  if (documentPackage ? !hasDocumentXml : !files.length) throw new Error(documentPackage ? "The file is not a valid Word document." : "No supported documents were found in this archive.");
  return { files, skipped };
}
