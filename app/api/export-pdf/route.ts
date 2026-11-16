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
    const monoFontData = (await readFile(path.join(process.cwd(), "public", "fonts", "noto-sans-mono.ttf"))).toString("base64");
    const html = `<!doctype html><html lang="my"><head><meta charset="utf-8"><title>${escapeHtml(body.bookTitle)}</title><style>
      @font-face { font-family: "Noto Sans Myanmar"; src: url(data:font/ttf;base64,${fontData}) format("truetype"); font-weight: 100 900; }
      @font-face { font-family: "Noto Sans Mono"; src: url(data:font/ttf;base64,${monoFontData}) format("truetype"); font-weight: 100 900; }
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { width: 174mm; margin: 0; color: #202522; font-family: "Noto Sans Myanmar", sans-serif; font-size: 11pt; line-height: 1.7; }
      h1 { font-size: 24pt; line-height: 1.25; margin: 0 0 8mm; page-break-after: avoid; }
      h2 { font-size: 17pt; line-height: 1.4; margin: 8mm 0 4mm; page-break-after: avoid; }
      h3, h4, h5, h6 { font-size: 13pt; line-height: 1.55; margin: 6mm 0 3mm; break-after: avoid; }
      h1, h2, h3, h4, h5, h6 { break-inside: avoid; overflow: hidden; padding: 1mm 0; }
      p { margin: 0 0 4mm; orphans: 3; widows: 3; }
      li { margin-bottom: 2mm; }
      ul, ol { padding-left: 7mm; margin: 0 0 4mm; }
      blockquote { border-left: 3px solid #8daba0; margin: 4mm 0; padding: 2mm 4mm; background: #f3f6f4; }
      blockquote p:last-child { margin-bottom: 0; }
      hr { border: 0; border-top: 1px solid #b9b9b0; margin: 7mm 0; }
      a { color: #285a62; overflow-wrap: anywhere; }
      code { font-family: "Noto Sans Mono", "Noto Sans Myanmar", monospace; font-size: 0.85em; }
      pre { margin: 4mm 0; padding: 4mm; background: #f3f5f4; border: 1px solid #d8dfdb; border-radius: 4px; font-family: "Noto Sans Mono", "Noto Sans Myanmar", monospace; font-size: 8.5pt; line-height: 1.55; }
      pre code { font-size: inherit; }
      .code-block { white-space: pre-wrap; overflow-wrap: anywhere; orphans: 3; widows: 3; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 5mm 0; font-size: 9pt; line-height: 1.65; }
      thead { display: table-header-group; }
      th, td { border: 1px solid #b9c7bf; padding: 2.5mm 3mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #e5ede8; font-weight: 700; }
      tbody tr:nth-child(even) { background: #f5f7f5; }
      tr { break-inside: avoid; }
      td p:last-child, th p:last-child { margin-bottom: 0; }
      .diagram { width: max-content; max-width: none; margin: 5mm 0; break-inside: avoid; page-break-inside: avoid; }
      .diagram-section { break-inside: avoid; page-break-inside: avoid; display: flow-root; }
      .diagram pre { margin: 0; white-space: pre; overflow-wrap: normal; font-size: 8.5pt; line-height: 1.5; }
      .mermaid-diagram { padding: 4mm; border: 1px solid #d8dfdb; border-radius: 4px; background: #fafcfb; }
      .mermaid-diagram svg { display: block; max-width: none !important; height: auto; }
      .diagram-fallback { font-size: 9pt; color: #665126; }
    </style></head><body>${markdownToHtml(body.markdown)}</body></html>`;

    const browserExecutablePath = await getBrowserExecutablePath();
    browser = await puppeteer.launch({
      args: process.platform === "win32" ? [] : chromium.args,
      executablePath: browserExecutablePath,
      headless: true,
    });
    const page = await browser.newPage();
    // All content and fonts are embedded. Generated diagrams must not make
    // requests to arbitrary external or local network resources.
    await page.setRequestInterception(true);
    page.on("request", (resource) => {
      if (/^(?:data:|about:)/.test(resource.url())) void resource.continue();
      else void resource.abort();
    });
    await page.emulateMediaType("print");
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    if (html.includes('class="mermaid-source"')) {
      const mermaidScript = await readFile(path.join(process.cwd(), "node_modules", "mermaid", "dist", "mermaid.min.js"), "utf8");
      await page.addScriptTag({ content: mermaidScript });
      await page.evaluate(async () => {
        const mermaid = (window as typeof window & {
          mermaid: {
            initialize(config: Record<string, unknown>): void;
            render(id: string, source: string): Promise<{ svg: string }>;
          };
        }).mermaid;
        mermaid.initialize({
          startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true,
          fontFamily: "Noto Sans Myanmar", theme: "neutral", htmlLabels: true,
          themeCSS: ".nodeLabel { line-height: 1.7; }",
          markdownAutoWrap: false,
          maxTextSize: 50_000, maxEdges: 300,
          flowchart: { htmlLabels: true, useMaxWidth: false, wrappingWidth: 280 },
          sequence: { useMaxWidth: false },
        });
        const blocks = Array.from(document.querySelectorAll<HTMLElement>(".mermaid-source"));
        for (const [index, block] of blocks.entries()) {
          // Keep manuscript-level directives from overriding print/security settings.
          const source = (block.textContent ?? "")
            .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "")
            .replace(/%%\{[\s\S]*?\}%%/g, "");
          try {
            const { svg } = await mermaid.render(`book-diagram-${index}`, source);
            block.parentElement!.innerHTML = svg;
          } catch {
            // Preserve the source if a generated diagram has invalid syntax.
            const note = document.createElement("figcaption");
            note.className = "diagram-fallback";
            note.textContent = "Diagram source (could not render automatically)";
            block.before(note);
          }
        }
      });
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      const availableWidth = document.body.clientWidth;
      const pageHeight = (297 - 36) * 96 / 25.4;
      for (const figure of document.querySelectorAll<HTMLElement>(".diagram")) {
        const heading = figure.previousElementSibling as HTMLElement | null;
        let headingHeight = 0;
        if (heading && /^H[1-6]$/.test(heading.tagName)) {
          const section = document.createElement("div");
          section.className = "diagram-section";
          heading.before(section);
          section.append(heading, figure);
          const headingStyle = getComputedStyle(heading);
          headingHeight = heading.getBoundingClientRect().height +
            parseFloat(headingStyle.marginTop) + parseFloat(headingStyle.marginBottom);
        }
        const style = getComputedStyle(figure);
        const availableHeight = pageHeight - headingHeight -
          parseFloat(style.marginTop) - parseFloat(style.marginBottom) - 8;
        const width = figure.scrollWidth;
        const height = figure.getBoundingClientRect().height;
        const scale = Math.min(1, availableWidth / width, availableHeight / height);
        figure.style.setProperty("zoom", String(scale));
      }
    });
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
