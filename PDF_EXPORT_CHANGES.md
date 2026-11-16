# PDF Export Changes

Last reviewed: 2026-11-16. This document describes the current server-side implementation first; earlier approaches are historical and are not active export paths.

## Current download flow

1. `app/page.tsx` assembles validated chapters into Markdown in outline order.
2. `components/DownloadPdfButton.tsx` sends the book title and Markdown to `POST /api/export-pdf`.
3. `lib/markdown-html.ts` uses a private Marked instance with GitHub-flavored Markdown support to produce HTML, escaping manuscript HTML and restricting links/images.
4. `app/api/export-pdf/route.ts` embeds Noto Sans Myanmar and Noto Sans Mono font data and launches Puppeteer/Chromium.
5. Fenced Mermaid diagrams are rendered locally. Fonts finish loading before diagram sizing and PDF printing.
6. Print layout keeps diagram headings/figures together and scales oversized figures to the printable area.
7. Chromium returns an A4 PDF as an attachment, and the browser downloads it directly.

There is no client-side canvas export, React PDF document, or browser print-dialog step in the active flow. The Myanmar TTF is actively embedded; it is not an unused legacy asset.

## Implemented formatting

- Standard Markdown pipe tables with borders, column headers, alternating rows, wrapping cells, and repeated headers across continued pages.
- Headings through level six, emphasis, lists, blockquotes, inline code, and complete multi-line code blocks.
- Preserved code punctuation, underscores, indentation, and escaped HTML inside code.
- Mermaid flowcharts/sequence diagrams with Myanmar labels and appropriate label spacing.
- Fenced ASCII diagrams as one monospace block; recognizable unfenced ASCII boxes are recovered as a block as well.
- Diagram keep-together rules, printable-area scaling, and heading pagination fixes.
- A visible labeled source fallback if Mermaid syntax cannot be rendered.

Standard Markdown tables still need a valid header separator row. Arbitrary text/ASCII tables are not automatically reconstructed as semantic tables. Existing ASCII diagrams are preserved, not inferred into Mermaid. Very large diagrams may become small when scaled; readability needs evaluation for unusually large sources.

## Fonts and runtime assets

- `public/fonts/noto-sans-myanmar.ttf`: embedded Myanmar font for body text and diagram labels.
- `public/fonts/noto-sans-mono.ttf`: embedded monospace font for code and ASCII alignment.
- `public/fonts/noto-sans-mono-OFL.txt`: redistribution license for the added monospace font.
- The existing Myanmar WOFF2 assets remain in the project; the PDF route reads the TTF.
- `node_modules/mermaid/dist/mermaid.min.js`: local browser bundle, explicitly traced into the PDF route deployment.
- `@sparticuz/chromium` binaries: externalized and explicitly traced through `next.config.ts`.

Use Node.js 22. Windows uses installed Chrome/Edge (or `PDF_BROWSER_EXECUTABLE_PATH`); Linux/Vercel uses the bundled Chromium binary.

## Rendering safeguards

- Manuscript HTML is escaped, with a narrowly allowed line-break tag.
- Unsafe link schemes do not become PDF links; external Markdown images become descriptions.
- Network requests are blocked during PDF rendering; fonts and the diagram renderer are embedded/local.
- Mermaid uses strict security mode, and manuscript configuration directives are removed before rendering.

These are implemented safeguards, not a claim of a completed application security audit.

## Verification completed on 2026-11-16

- Eight Markdown renderer regression tests passed, including tables, escaped pipes, Burmese text, code spacing, legacy ASCII, Mermaid blocks, and HTML/link handling.
- `npm run lint` and `npm run build` passed, including TypeScript checks.
- Local PDF smoke tests passed using the production server.
- Live Vercel PDF smoke tests returned valid PDF responses for the mixed-format and pagination fixtures.
- The mixed-format fixture produced four pages; table and diagram preview pages were inspected visually.
- Text extraction retained expected table/code/diagram labels, with no fallback for the valid Mermaid examples.
- The five-page stress fixture retained all 65 rows, repeated table headers, the invalid-diagram fallback, and the final document marker.
- GitHub CI and Vercel deployment succeeded for formatting commit `563524f`.

These checks establish the behavior of the fixtures and inspected pages. They do not verify every historical book, every diagram type, all large-table edge cases, or every PDF viewer.

## Reproduce the checks

Start a local production server, then run:

```bash
npm test
node tests/pdf-export-smoke.mjs http://localhost:3002 tmp/pdfs
```

Check the deployed endpoint:

```bash
node tests/pdf-export-smoke.mjs https://learning-space-delta.vercel.app tmp/pdfs/deployed
```

The script saves `formatting-sample.pdf` and `pagination-stress.pdf`. Use Poppler rendering for visual inspection and a PDF text parser for retained-content checks. A successful HTTP response or build alone does not prove layout quality.

## Historical approaches (superseded)

1. Browser print-window exports required the user to choose a PDF destination manually.
2. `html2pdf.js`/`html2canvas` were tried for direct client downloads; blank/raster output problems were reported.
3. `jsPDF` text placement was tried with Myanmar fonts; reported output had overlapping marks and unsuitable shaping.
4. Native print and `@react-pdf/renderer` were tried in later iterations. The React PDF attempt still had reported Myanmar mark-positioning problems and was removed.
5. Server-side Puppeteer/Chromium replaced those paths so browser text shaping handles Myanmar text.
6. A deployment failure involving the missing `@sparticuz/chromium/bin` directory was corrected by externalizing Chromium and tracing its binary files.
7. The old line-by-line Markdown converter printed pipe tables as text, split diagram lines into separate blocks, used a proportional font for ASCII, and supported too few Markdown constructs.
8. Commit `563524f` replaced that converter with GFM parsing, local Mermaid rendering, embedded monospace fonts, and diagram/table pagination rules.

Earlier notes saying no PDF library was used, the TTF was unused, the active button opened a print dialog, or PDF inspection had never succeeded are superseded by the current implementation and scoped verification above.

## Remaining work

- Verify/fix table-of-contents anchors and exported internal links.
- Add optional chapter page-break controls, syntax highlighting, cover pages, and metadata controls.
- Evaluate unusually large diagrams and tables, more Mermaid diagram types, and multiple PDF viewers.
- Add durable private export storage and a user-owned download history after authentication/storage design.
- Add EPUB export separately.

Download a PDF again after deployment to apply the new renderer. Previously downloaded files are unchanged. A regenerated chapter can use the newer Mermaid prompt, while an existing saved chapter keeps its original Markdown content.
