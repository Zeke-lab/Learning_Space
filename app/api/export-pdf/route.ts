import { access, readFile } from "node:fs/promises";
import path from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { NextRequest, NextResponse } from "next/server";

import { markdownToHtml } from "@/lib/markdown-html";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

async function getBrowserExecutablePath() {
  const configuredPath = process.env.PDF_BROWSER_EXECUTABLE_PATH;
  if (configuredPath) return configuredPath;

  if (process.platform === "win32") {
    const candidates = [
      path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error(
      "PDF export needs Google Chrome or Microsoft Edge installed on the server. Set PDF_BROWSER_EXECUTABLE_PATH if it is installed in a custom location.",
    );
  }

  return chromium.executablePath();
}

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    const body = await request.json() as { bookTitle?: string; markdown?: string };
    if (!body.bookTitle || !body.markdown) {
      return NextResponse.json({ error: "A book title and manuscript are required." }, { status: 400 });
    }

    const fontPath = path.join(process.cwd(), "public", "fonts", "noto-sans-myanmar.ttf");
    const fontData = (await readFile(fontPath)).toString("base64");
    const html = `<!doctype html><html lang="my"><head><meta charset="utf-8"><title>${escapeHtml(body.bookTitle)}</title><style>
      @font-face { font-family: "Noto Sans Myanmar"; src: url(data:font/ttf;base64,${fontData}) format("truetype"); font-weight: 100 900; }
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { color: #202522; font-family: "Noto Sans Myanmar", sans-serif; font-size: 11pt; line-height: 1.7; }
      h1 { font-size: 24pt; line-height: 1.25; margin: 0 0 8mm; page-break-after: avoid; }
      h2 { font-size: 17pt; line-height: 1.4; margin: 8mm 0 4mm; page-break-after: avoid; }
      h3 { font-size: 13pt; line-height: 1.45; margin: 6mm 0 3mm; page-break-after: avoid; }
      p { margin: 0 0 4mm; orphans: 3; widows: 3; }
      .bullet { padding-left: 6mm; }
      .space { height: 3mm; }
      hr { border: 0; border-top: 1px solid #b9b9b0; margin: 7mm 0; }
      pre { white-space: pre-wrap; font-family: "Noto Sans Myanmar", sans-serif; }
    </style></head><body>${markdownToHtml(body.markdown)}</body></html>`;

    const browserExecutablePath = await getBrowserExecutablePath();
    browser = await puppeteer.launch({
      args: process.platform === "win32" ? [] : chromium.args,
      executablePath: browserExecutablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${body.bookTitle.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "complete-book"}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The PDF could not be generated.";
    console.error("PDF export failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
