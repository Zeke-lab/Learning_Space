# AI Book Studio / Learning Space

Turn a technical learning topic into an outline, generate chapters, assemble a Markdown manuscript, and download it as Markdown or PDF.

Live app: https://learning-space-delta.vercel.app/

Repository: https://github.com/Zeke-lab/Learning_Space

For a plain-language tour with workflow diagrams, read [APPLICATION_GUIDE.md](APPLICATION_GUIDE.md). With the local server running, regenerate its reading copy using `node scripts/export-application-guide.mjs`.

Status reviewed: 2026-11-20. See [TODO.md](TODO.md) for completed work, verification limits, and remaining tasks, and [PDF_EXPORT_CHANGES.md](PDF_EXPORT_CHANGES.md) for the PDF implementation and history.

Google OpenID Connect sign-in is deployed and verified with the registered owner; see [AUTH_SETUP.md](AUTH_SETUP.md). Google remains in External/Testing mode. The app has account sessions and separate browser workspaces; it does not yet persist users/books in a database or sync books/PDFs across devices.

## Current features

- A topic field with a 10,000-character limit and character count.
- A structured outline with title, subtitle, chapter goals, sections, prerequisites, and page estimates.
- Individual chapter generation/regeneration and `Write all chapters` with up to two requests at once.
- Independent writing/error/retry states, ordered manuscript assembly, and browser session recovery.
- Markdown download with UTF-8 BOM and server-generated A4 PDF download.
- Formatted PDF tables, lists, headings, code, Mermaid diagrams, and preserved ASCII diagrams, with embedded Myanmar/monospace fonts.

Prompts request tutor-style explanations, continuity, limited repetition, matching language, and version-aware examples. These are writing instructions, not guarantees of factual accuracy or complete teaching quality. Generated content still needs review.

## Local setup

Use Node.js 22 and install dependencies:

```bash
npm ci
```

Create a local `.env.local` using `.env.local.example` as a reference. Set `GOOGLE_GENERATIVE_AI_API_KEY` to your Gemini API key. Environment files are ignored by Git; do not commit credentials.

Optional configuration:

- `GEMINI_MODEL`: initial Gemini model to request; fallback behavior is in `lib/gemini-rest.ts`.
- `PDF_BROWSER_EXECUTABLE_PATH`: Chrome/Edge executable when installed in a custom location.

On Windows, PDF export needs an installed Google Chrome or Microsoft Edge. Linux/Vercel uses the bundled `@sparticuz/chromium` binary.

Start development:

```bash
npm run dev
```

Open http://localhost:3000. When testing from a phone, use the computer's current LAN address and the same network; `localhost` on the phone refers to the phone itself.

## Chapter generation and recovery

The outline is generated first. Each chapter request receives the book title, chapter goals/sections/prerequisites, and next-chapter title. It does not receive the full text of previous chapters.

`Write all chapters` keeps at most two requests active. Completed results are merged in outline order even if the requests finish out of order. If a chapter fails, no new queued chapters start; requests already running finish and successful chapters are retained. Use the per-chapter retry action or `Write all chapters` to resume missing chapters. If every chapter exists, the batch action becomes `Regenerate all chapters`.

Zod validates response structure. Chapter checks also require matching title/number, sufficient Markdown length, and Parts I-IV headings. The server retries malformed or incomplete content, and the Gemini helper has bounded retries/fallbacks for retryable provider responses. These checks do not establish factual correctness or validate generated code.

The two-request queue is a browser-side control. It is not server-side rate limiting or a per-user quota.

## Storage and privacy

The app supports Google sign-in but has no persistent database account records, production database connection, or private cloud file store. The outline and generated chapters are stored in browser localStorage: `ai-book-studio-session` for guests and a user-specific key for signed-in accounts. Storage is scoped to the browser profile and website origin. Books do not automatically sync between a phone and laptop, between browser profiles, or between localhost and the deployed site.

PDFs and Markdown are downloaded to the user's device. The server does not retain a durable library of exported files. Persistent user records, server-side book/file ownership checks, backend storage, book history, and cloud refetching remain planned work in [TODO.md](TODO.md).

## PDF export

`Download PDF` sends the manuscript to the server, which converts Markdown to HTML and prints it with Puppeteer/Chromium. No client print dialog is required.

- Standard Markdown tables render as bordered rows/columns and repeat headers across pages.
- Fenced Mermaid diagrams render as graphics with embedded Myanmar fonts.
- Fenced ASCII diagrams and recognizable unfenced ASCII boxes retain monospace alignment.
- Diagrams stay with their headings and scale to the printable area.
- Invalid Mermaid syntax produces a labeled source fallback.
- Code keeps punctuation and indentation; syntax highlighting is not implemented.

Previously downloaded PDFs do not change after a deployment. Download again from the saved book to use the current renderer. Existing ASCII source is preserved rather than automatically converted to Mermaid; newly generated chapters are prompted to use Mermaid.

## Validation

```bash
npm test
npm run lint
npm run build
```

The unit suite contains 24 Markdown, chapter-queue, auth-policy and database-configuration tests. Run `npm run test:db` for 22 isolated database schema/ownership checks and `npm run test:auth` after a production build for 11 synthetic-session HTTP checks. GitHub Actions runs these checks, lint, and the production build/type check. Real Google login is verified separately as described in AUTH_SETUP.md.

For a production-mode local PDF check, run these in separate terminals:

```bash
npm run build
npm run start -- -p 3002
```

```bash
node tests/pdf-export-smoke.mjs http://localhost:3002 tmp/pdfs
```

To check the deployed PDF endpoint:

```bash
node tests/pdf-export-smoke.mjs https://learning-space-delta.vercel.app tmp/pdfs/deployed
```

The smoke script checks response status, content type, and PDF signature and saves a mixed-format sample and pagination fixture. Inspect rendered pages and extracted text as well; HTTP success alone does not establish correct layout. The fixture is [tests/fixtures/pdf-formatting.md](tests/fixtures/pdf-formatting.md).

## Deployment

Database foundation: [db/README.md](db/README.md) describes the PostgreSQL entities, ownership rules, migration, and integration sequence. Run `npm run test:db` for isolated schema checks. This design is not connected to the running app; current books still use browser localStorage. For a real Google login test, follow [AUTH_SETUP.md](AUTH_SETUP.md#test-google-sign-in-on-your-laptop).

Deploy as a Next.js server on Vercel with Node.js 22. Set `GOOGLE_GENERATIVE_AI_API_KEY` in the project's deployment environment. The connected Vercel project builds pushes to `main`; check GitHub Actions and the Vercel deployment status after publishing.

The app needs server routes, so GitHub Pages/static export is not a supported deployment target. `next.config.ts` externalizes Chromium and traces its binaries plus the Mermaid browser bundle for PDF export.

Latest published implementation milestones are recorded in [TODO.md](TODO.md). Learner feedback and remaining content-quality checks are in [priority prompt for coding.md](<priority prompt for coding.md>).
