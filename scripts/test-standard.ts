import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { mergeExtraction } from "../lib/ai/contract";
import { emptyDeedData, parseDeedData, partySchema, standardWorkspaceSchema } from "../lib/schemas/deed-data";
import { unpackArchive } from "../lib/uploads/archives";
import { normalizeUpload } from "../lib/uploads/normalize";
import { checkEntry, MAX_EXPANDED_BYTES, MAX_UPLOAD_BYTES, safeArchiveName } from "../lib/uploads/policy";
import { uploadPaths } from "../lib/uploads/paths";
import { signedUploadEndpoint } from "../lib/uploads/mime";

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Synthetic fixtures only: no client papers or personal information.
function zip(entries: Array<{ name: string; text: string; claimedSize?: number; encrypted?: boolean }>) {
  const chunks: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), bytes = Buffer.from(entry.text), compressed = deflateRawSync(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(entry.encrypted ? 1 : 0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(bytes), 14); local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.claimedSize ?? bytes.length, 22); local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, compressed);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(entry.encrypted ? 1 : 0, 8); dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc32(bytes), 16); dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(entry.claimedSize ?? bytes.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}

function rar(name: string, content: string) {
  const main = Buffer.alloc(13);
  main[2] = 0x73; main.writeUInt16LE(13, 5);
  main.writeUInt16LE(crc32(main.subarray(2)) & 0xffff);
  const fileName = Buffer.from(name), bytes = Buffer.from(content), header = Buffer.alloc(32 + fileName.length);
  header[2] = 0x74; header.writeUInt16LE(0x8000, 3); header.writeUInt16LE(header.length, 5);
  header.writeUInt32LE(bytes.length, 7); header.writeUInt32LE(bytes.length, 11); header[15] = 2;
  header.writeUInt32LE(crc32(bytes), 16); header[24] = 20; header[25] = 0x30;
  header.writeUInt16LE(fileName.length, 26); header.writeUInt32LE(0x20, 28); fileName.copy(header, 32);
  header.writeUInt16LE(crc32(header.subarray(2)) & 0xffff);
  const end = Buffer.alloc(7); end[2] = 0x7b; end.writeUInt16LE(7, 5); end.writeUInt16LE(crc32(end.subarray(2)) & 0xffff);
  return Buffer.concat([Buffer.from("526172211a0700", "hex"), main, header, bytes, end]);
}

async function main() {
  let checks = 0;
  async function test(name: string, run: () => unknown | Promise<unknown>) {
    await run(); checks++; console.log("  ✓ " + name);
  }
  await test("Resumable source and converted files match deployed three-part Storage RLS", () => {
    const firm = "11111111-1111-4111-8111-111111111111";
    const deed = "22222222-2222-4222-8222-222222222222";
    const upload = "33333333-3333-4333-8333-333333333333";
    const paths = uploadPaths(firm, deed, upload, "pdf");
    for (const path of [paths.path, paths.prefix + "0.pdf", paths.prefix + "29.jpg"]) {
      assert.equal(path.split("/").length, 3);
      assert.deepEqual(path.split("/").slice(0, 2), [firm, deed]);
      assert.ok(path.split("/")[2].startsWith(upload + "-"));
    }
    assert.equal(uploadPaths(firm, deed, upload, "pdf").path, paths.path);
  });
  await test("Signed upload tokens use the signed TUS endpoint", () => {
    assert.equal(signedUploadEndpoint("https://example.supabase.co"), "https://example.storage.supabase.co/storage/v1/upload/resumable/sign");
    assert.equal(signedUploadEndpoint("http://127.0.0.1:54321"), "http://127.0.0.1:54321/storage/v1/upload/resumable/sign");
  });
  await test("Optional modules are hidden for new AND legacy deeds; settings round-trip", () => {
    assert.deepEqual(emptyDeedData().workspace.modules, { naksha: false, consideration: false });
    assert.deepEqual(parseDeedData({}).workspace.modules, { naksha: false, consideration: false });
    const workspace = standardWorkspaceSchema.parse({ modules: { naksha: true, consideration: false } });
    assert.equal(parseDeedData({ workspace }).workspace.modules.naksha, true);
    const current = parseDeedData({ workspace, consideration: { total: 125000 } });
    assert.equal(parseDeedData({ ...current, workspace: { ...workspace, modules: { naksha: false, consideration: false } } }).consideration.total, 125000);
  });
  await test("AI preserves manual overrides and supports multiple buyers, sellers and witnesses", () => {
    const person = (fullName: string, role: "first" | "second" | "witness") => partySchema.parse({ id: fullName, fullName, role, relation: "S/o", address: "Manually verified address" });
    const current = parseDeedData({ parties: [person("Seller One", "first")], workspace: { modules: { naksha: true } } });
    const next = mergeExtraction(current, { parties: [
      { ...person("Seller One", "first"), address: "AI address" }, person("Seller Two", "first"),
      person("Buyer One", "second"), person("Buyer Two", "second"), person("Witness One", "witness"), person("Witness Two", "witness"),
    ] });
    assert.equal(next.parties.length, 6);
    assert.equal(next.parties[0].address, "Manually verified address");
    assert.equal(next.workspace.modules.naksha, true);
    assert.equal(mergeExtraction(next, { parties: next.parties }).parties.length, 6);
  });
  await test("Reject unsafe paths, oversized entries, totals and file counts", () => {
    for (const name of ["../paper.pdf", "/paper.pdf", "C:\\paper.pdf", "dir/../../x.pdf", "bad\0.pdf"]) assert.throws(() => safeArchiveName(name));
    assert.equal(safeArchiveName("folder/paper.pdf"), "paper.pdf");
    assert.throws(() => checkEntry("x.pdf", MAX_UPLOAD_BYTES + 1, 0, 1));
    assert.throws(() => checkEntry("x.pdf", 1, MAX_EXPANDED_BYTES, 1));
    assert.throws(() => checkEntry("x.pdf", 1, 0, 31));
  });
  await test("ZIP extracts nested folders in memory and reports unsupported files", async () => {
    const result = await unpackArchive(zip([{ name: "papers/title.pdf", text: "%PDF-synthetic" }, { name: "readme.txt", text: "info" }]), "zip");
    assert.equal(result.files[0].name, "title.pdf");
    assert.equal(result.files[0].bytes.toString(), "%PDF-synthetic");
    assert.deepEqual(result.skipped, ["readme.txt"]);
  });
  await test("ZIP rejects traversal, nesting, encryption, forged sizes and bombs", async () => {
    for (const entry of [
      { name: "../x.pdf", text: "test" }, { name: "inner.zip", text: "test" },
      { name: "x.pdf", text: "test", encrypted: true },
      { name: "x.pdf", text: "test", claimedSize: MAX_UPLOAD_BYTES + 1 },
      { name: "x.pdf", text: "A".repeat(10000), claimedSize: 10 },
    ]) await assert.rejects(unpackArchive(zip([entry]), "zip"));
    await assert.rejects(unpackArchive(zip(Array.from({ length: 31 }, (_, i) => ({ name: i + ".pdf", text: "x" }))), "zip"));
  });
  await test("RAR extracts a real stored RAR fixture and rejects traversal / corruption", async () => {
    const result = await unpackArchive(rar("papers/title.pdf", "%PDF-synthetic"), "rar");
    assert.equal(result.files[0].name, "title.pdf");
    assert.equal(result.files[0].bytes.toString(), "%PDF-synthetic");
    await assert.rejects(unpackArchive(rar("../outside.pdf", "test"), "rar"));
    await assert.rejects(unpackArchive(Buffer.from("not an archive"), "rar"));
  });
  await test("Word packages are bounded and require word/document.xml", async () => {
    const docx = zip([{ name: "word/document.xml", text: "<document>Test</document>" }]);
    const result = await normalizeUpload({ name: "test.docx", bytes: docx });
    assert.equal(result.bytes, docx);
    await assert.rejects(normalizeUpload({ name: "test.docx", bytes: zip([{ name: "x.xml", text: "test" }]) }));
    await assert.rejects(normalizeUpload({ name: "test.docx", bytes: zip([{ name: "word/document.xml", text: "test", claimedSize: MAX_UPLOAD_BYTES + 1 }]) }));
  });
  await test("PNG/JPEG/WebP retained; GIF/AVIF/TIFF normalized; malformed formats rejected", async () => {
    const image = sharp({ create: { width: 16, height: 16, channels: 3, background: "#fff" } });
    for (const format of ["png", "jpeg", "webp", "gif", "avif", "tiff"] as const) {
      const bytes = await image.clone().toFormat(format).toBuffer();
      const result = await normalizeUpload({ name: "test." + format, bytes });
      assert.ok(["image/png", "image/jpeg", "image/webp"].includes(result.mime), format);
      assert.ok(result.bytes.length > 0);
    }
    await assert.rejects(normalizeUpload({ name: "test.pdf", bytes: Buffer.from("not pdf") }));
    await assert.rejects(normalizeUpload({ name: "test.png", bytes: Buffer.from("<svg></svg>") }));
  });
  await test("Multi-page TIFF retains every page in a PDF", async () => {
    const bytes = await sharp({ create: { width: 16, height: 32, pageHeight: 16, channels: 3, background: "#fff" } }).tiff().toBuffer();
    const result = await normalizeUpload({ name: "pages.tiff", bytes });
    assert.equal(result.mime, "application/pdf");
    assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 2);
  });
  console.log("\n" + checks + " Standard Mode checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
