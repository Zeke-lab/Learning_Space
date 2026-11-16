import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Run against a local production server or the deployed app. No AI generation
// is needed: the fixture makes PDF layout regressions reproducible.
const baseUrl = process.argv[2] ?? "http://localhost:3002";
const outputDir = process.argv[3] ?? "tmp/pdfs";
await mkdir(outputDir, { recursive: true });

const sample = await readFile(new URL("./fixtures/pdf-formatting.md", import.meta.url), "utf8");
const rows = Array.from({ length: 65 }, (_, i) => `| ROW-${String(i + 1).padStart(3, "0")} | မြန်မာစာ စမ်းသပ်အချက်အလက် | Row ${i + 1} must remain in the exported PDF. |`).join("\n");
const wideLine = "+" + "-".repeat(150) + "+";
const stress = "# Pagination regression\n\n| Row ID | မြန်မာစာ | Details |\n| --- | --- | --- |\n" + rows +
  "\n\n## Wide legacy diagram\n\n```text\n" + wideLine + "\n|" + "Wide diagram".padEnd(150) + "|\n" + wideLine +
  "\n```\n\n## Invalid diagram fallback\n\n```mermaid\nthis is deliberately invalid diagram syntax\n```\n\nEND-OF-DOCUMENT\n";

for (const [name, markdown] of [["formatting-sample", sample], ["pagination-stress", stress]]) {
  const response = await fetch(new URL("/api/export-pdf", baseUrl), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle: name, markdown }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    assert.fail(`${name}: HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);
  const pdf = Buffer.from(await response.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 10_000);
  const target = path.join(outputDir, `${name}.pdf`);
  await writeFile(target, pdf);
  console.log(`${name}: HTTP 200, PDF signature valid, ${pdf.length} bytes, ${target}`);
}
