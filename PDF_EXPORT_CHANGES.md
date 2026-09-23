# PDF Export Changes

## Starting Point: Previous Edition

The previous edition had these export actions:

- **Download Markdown** created a `.md` file from the compiled manuscript.
- **Save as PDF** opened a browser print window and called `window.print()`.
- The browser print flow required the user to choose **Save to PDF** manually.
- The print document used the browser's available Myanmar fonts:
  - `Myanmar Text`
  - `Noto Sans Myanmar`
- There was no bundled PDF font.

## Changes Added

### 1. PDF action renamed

Changed the visible action from:

```text
Save as PDF
```

to:

```text
Download PDF
```

The handler was renamed from `savePdf` to `downloadPdf`.

### 2. Direct PDF download attempt

Added a client-side PDF export dependency and replaced the print-window flow with a direct download flow.

The first implementation used `html2pdf.js` and `html2canvas`. It:

- Created an HTML export container.
- Applied A4 styling.
- Attempted to download a PDF automatically.
- Added local WOFF2 Myanmar font files.

### 3. Blank-page fix attempt

The export container was initially positioned far outside the viewport. That could result in an empty canvas and a blank PDF.

The container was changed to render at the document origin, and the implementation waited for the Myanmar web font before calling the exporter.

### 4. Markdown encoding

The Markdown download now includes a UTF-8 BOM:

```ts
new Blob([`\ufeff${compiledBook}`], {
  type: "text/markdown;charset=utf-8",
});
```

This helps Windows applications detect the file as UTF-8 and display Myanmar text correctly.

### 5. Text-PDF implementation attempt

After the generated PDF was reported as:

```text
PDF PARSED TEXT:
No content (images or text) could be read from document 'document.pdf'.
```

the raster-based `html2pdf.js` implementation was removed.

The attempted implementation used `jsPDF` and:

- Loads `noto-sans-myanmar.ttf` from `public/fonts`.
- Embeds the font into the PDF with `addFileToVFS` and `addFont`.
- Writes headings and paragraphs as PDF text objects.
- Wraps long lines using `splitTextToSize`.
- Creates additional pages when content reaches the page bottom.
- Downloads the PDF using the book title as the filename.

This implementation was not suitable for Myanmar text. The PDF contained text objects, but jsPDF did not perform the complex-script shaping and mark positioning required by Myanmar. The resulting output had overlapping marks and clipped-looking headings, as shown in the reported PDF screenshot.

### 6. Current PDF implementation: native browser printing

The jsPDF implementation was replaced with the browser's native print engine. The current action is labeled **Print / Save PDF** because browsers do not allow a web page to silently choose the user's PDF destination.

The current flow:

1. Opens a print-ready document in a new window.
2. Loads the local Noto Sans Myanmar WOFF2 font.
3. Waits for `document.fonts.ready`.
4. Calls the browser's print dialog.
5. Lets the user choose **Save to PDF**.

This uses Chromium's text shaping engine, so Myanmar syllables and combining marks should be laid out correctly and the resulting PDF should contain selectable text. This is more reliable for Myanmar than manually placing Unicode strings with jsPDF.

### 7. Local font assets

Added these local WOFF2 assets during the earlier implementation:

- `public/fonts/noto-sans-myanmar-400.woff2`
- `public/fonts/noto-sans-myanmar-600.woff2`
- `public/fonts/noto-sans-myanmar-700.woff2`

The TTF used by the jsPDF attempt is retained as an unused asset for now. The WOFF2 files are used by the print document.

### 8. Dependencies

Added and later removed:

- `html2pdf.js`
- `@fontsource/noto-sans-myanmar`

No PDF-generation library is currently used. PDF creation is delegated to the browser print engine.

## Validation Completed

These checks passed:

- `npm run lint`
- `npm run build`
- The app builds successfully after switching to native printing.

## Important Verification Limitation

The browser-generated PDF was not successfully inspected with a PDF text-extraction tool in this environment. The environment did not have `pdftotext` installed, and a real generated manuscript was not exported during automated testing.

Therefore, the following claims remain to be verified with an actual downloaded PDF:

- Whether a PDF parser extracts the Myanmar text correctly.
- Whether Myanmar glyph shaping is visually correct in every browser.
- Whether the browser's saved PDF extracts Myanmar text correctly in every PDF parser.

The previous claim that parser-readable Myanmar PDF output had been fully verified was incorrect.

## Current Files Changed For This Work

- `app/page.tsx`
- `package.json`
- `package-lock.json`
- `public/fonts/noto-sans-myanmar-400.woff2`
- `public/fonts/noto-sans-myanmar-600.woff2`
- `public/fonts/noto-sans-myanmar-700.woff2`
- `public/fonts/noto-sans-myanmar.ttf` (retained but unused)
- `PDF_EXPORT_CHANGES.md`

## Reported Output And Fix

The reported output showed correct-looking Myanmar characters in some places but overlapping marks and a clipped Chapter 1 heading. This was caused by jsPDF placing Myanmar code points without complex-script shaping.

The fix is to use **Print / Save PDF** with the browser's native print renderer. In the print dialog, choose **Save to PDF**. Do not use the old jsPDF-generated file; it is the output that produced the malformed layout.

## React PDF Renderer Attempt

The failed native-print PDF path was removed from `app/page.tsx` before starting this implementation.

The requested `@react-pdf/renderer` approach was then added:

- Added `@react-pdf/renderer` to the project dependencies.
- Added `components/BookPdfDocument.tsx`.
- Added `components/DownloadPdfButton.tsx`.
- Registered `public/fonts/noto-sans-myanmar.ttf` with `Font.register`.
- Rendered the compiled Markdown as PDF `Text` objects instead of an HTML screenshot.
- Added A4 page layout, headings, dividers, wrapping, and page numbers.
- Loaded the download button with `next/dynamic` and `ssr: false`.
- Kept the existing Markdown download unchanged.

The current button is **Download PDF** and uses `PDFDownloadLink`.

Validation completed for this attempt:

- `npm run lint` passed.
- `npm run build` passed.

The actual Myanmar PDF still needs to be generated in the browser and checked visually and with a PDF text parser. Passing TypeScript, lint, and build confirms the integration compiles; it does not prove that `@react-pdf/renderer` performs Myanmar shaping correctly in the downloaded file.

## Reported React PDF Error And Puppeteer Fix

The generated React PDF screenshot showed that some Myanmar words still had overlapping vowel signs and subscript marks. The font was embedded, but `@react-pdf/renderer` was not performing the Myanmar OpenType shaping required to position those marks correctly.

The React PDF implementation was removed and replaced with a server-side Chromium implementation:

- Added `puppeteer-core` and `@sparticuz/chromium` for serverless deployment.
- Added `app/api/export-pdf/route.ts`.
- Added `lib/markdown-html.ts` for escaped Markdown-to-HTML conversion.
- Updated `components/DownloadPdfButton.tsx` to POST the manuscript to `/api/export-pdf`.
- The route embeds `public/fonts/noto-sans-myanmar.ttf` as a data URL in the HTML.
- The serverless Chromium binary renders the HTML and uses its HarfBuzz text shaping engine for Myanmar.
- The route returns the generated PDF as an attachment.
- Removed `@react-pdf/renderer` and the failed `components/BookPdfDocument.tsx` implementation.

The client now downloads the server response directly instead of opening a print dialog or using a canvas/image PDF.

Validation after this change:

- `npm run lint` passed.
- `npm run build` passed.
- The `/api/export-pdf` route is included as a dynamic server route.

## Current Report/PDF Generation Method

The report system uses a Markdown-to-HTML-to-PDF pipeline:

1. Chapters are generated by the AI API and combined into one Markdown manuscript.
2. The client sends the manuscript and book title to the Next.js `/api/export-pdf` route.
3. The route converts the Markdown to escaped HTML with `lib/markdown-html.ts`.
4. `puppeteer-core` launches the serverless Chromium binary supplied by `@sparticuz/chromium`.
5. Chromium loads the bundled `Noto Sans Myanmar` font and shapes the Myanmar text.
6. Chromium prints the HTML as an A4 PDF and the route returns it as a download.

This server-side browser-rendering method is used instead of `jsPDF` or `@react-pdf/renderer` because those approaches do not reliably shape Myanmar combining marks.

## Final Verified Result

The Markdown-to-PDF export now works successfully:

1. The generated chapters are assembled into the compiled Markdown manuscript.
2. The client sends the Markdown and book title to `/api/export-pdf`.
3. The API converts the Markdown into escaped HTML.
4. Puppeteer loads the HTML in Chromium with the bundled Noto Sans Myanmar font.
5. Chromium shapes the Myanmar text correctly using its browser text engine.
6. Puppeteer generates an A4 PDF.
7. The API returns the PDF as a downloadable file.
8. The browser downloads the final `.pdf` file using the book title.

The final Markdown-to-PDF transfer is verified as successful, including the Myanmar text rendering path.


