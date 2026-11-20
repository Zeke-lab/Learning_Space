# AI Book Studio TODO

Last reviewed: 2026-11-20 (Asia/Bangkok).

Checked items describe implemented work or the specific verification named. They do not mean every generated book has been reviewed for accuracy or teaching quality.

## Current product

`Topic -> Book outline -> Up to two concurrent chapters -> Ordered Markdown manuscript -> Markdown/PDF download`

The app generates a curriculum first, then writes chapters independently. The manuscript follows outline order even when chapter requests finish out of order. Google sign-in is deployed for the registered test owner; books recover from account-scoped browser localStorage. There is no production database connection or persistent account/book storage yet.

## Completed implementation

### Foundation and deployment

- [x] Next.js App Router, TypeScript, React, Tailwind CSS, and Node.js 22 deployment configuration.
- [x] Server-side Gemini REST calls in `lib/gemini-rest.ts`; API credentials are read from server environment variables.
- [x] Deploy the app as a Next.js server on Vercel, with dynamic outline, chapter, and PDF routes.
- [x] Replace the obsolete GitHub Pages deployment workflow with validation checks; retain the Next.js build workflow.
- [x] Run lint, automated tests, TypeScript checks, and production build in GitHub Actions.

### Outline and chapter generation

- [x] Accept a topic of up to 10,000 characters and show a character count.
- [x] Generate a title, subtitle, estimated page count, and structured chapter outline.
- [x] Validate outline and chapter data with Zod.
- [x] Generate or regenerate individual chapters without discarding the outline or other completed chapters.
- [x] Add tutor-style, language-matching, non-repetition, and version-awareness instructions to the generation prompts.
- [x] Request chapter goals, prerequisites, examples, four Parts I-IV, recap, and next-chapter context.
- [x] Reject chapter responses with a mismatched title/number, insufficient Markdown length, or missing required Part headings.
- [x] Retry malformed or incomplete chapter content up to three content attempts.
- [x] Set an output-token limit and detect output-token truncation.
- [x] Add bounded retries for retryable Gemini HTTP responses and configured fallback models.
- [x] Request Mermaid diagrams and standard Markdown comparison tables in newly generated chapters.

Prompt instructions are implemented; factual accuracy, non-repetition, current-version examples, and tutor quality still need human evaluation. The request does not include the full text of previously generated chapters.

### Workspace, concurrency, and recovery

- [x] Display chapter goals, estimates, generated counts, and an assembled manuscript.
- [x] Add `Write all chapters` with at most two requests active at a time.
- [x] Show each active chapter and retain independent per-chapter errors/retry actions.
- [x] Count finished requests during a batch and keep completed chapter content in outline order.
- [x] Stop starting new chapters after a failure, wait for requests already in flight, and retain successful results.
- [x] Resume missing chapters with `Write all chapters`; regenerate all when every chapter already exists.
- [x] Guard duplicate generation and block outline replacement or clearing while chapter generation is running.
- [x] Save and restore the outline and chapters through the `ai-book-studio-session` localStorage entry.
- [x] Add a clear-book action. A confirmation dialog is not implemented.
- [x] Download the assembled Markdown with a UTF-8 BOM for Myanmar text compatibility.

The two-request limit is per running browser batch, not a server-wide or per-account rate limit.

### PDF publishing

- [x] Download server-generated A4 PDFs through Puppeteer/Chromium.
- [x] Embed Noto Sans Myanmar and Noto Sans Mono fonts.
- [x] Render Markdown tables, headings, emphasis, lists, blockquotes, and code blocks.
- [x] Preserve code indentation, underscores, and multi-line blocks.
- [x] Render fenced Mermaid flowcharts and sequence diagrams as graphics.
- [x] Preserve fenced ASCII diagrams and recover recognizable unfenced ASCII boxes.
- [x] Keep diagram headings and figures together, scaling diagrams to the printable area.
- [x] Repeat table headers on continued pages and avoid splitting ordinary table rows.
- [x] Preserve invalid Mermaid source with a visible fallback label.
- [x] Block external network requests during PDF rendering and escape manuscript HTML.
- [x] Support Chrome/Edge on Windows and bundled Chromium on Linux/Vercel.
- [x] Trace Chromium assets, the Mermaid browser bundle, and embedded fonts for deployment.

## Verification completed

- [x] `npm test`: 18 tests passed (8 Markdown renderer, 4 concurrency/queue, and 6 auth-policy cases).
- [x] `npm run test:db`: 22 isolated PostgreSQL checks passed, including forward UUID migration with existing books and isolation of private authentication records.
- [x] Queue tests cover two concurrent requests, slot refill, stopping queued work after a failure, draining in-flight work, rejection handling, and empty/single-item queues.
- [x] `npm run lint` and `npm run build` passed; the build includes TypeScript checking.
- [x] GitHub build and validation checks passed for the published implementation commits below.
- [x] Local browser test: click `Write all chapters`, observe both chapters writing at once, then verify two completed Burmese JavaScript chapters and manuscript order.
- [x] Live deployed outline/chapter requests generated Burmese MCP content in earlier endpoint checks.
- [x] Live invalid chapter request returned HTTP 400.
- [x] Live PDF smoke checks: valid PDF responses for a four-page mixed-format sample and a five-page pagination fixture.
- [x] Inspect table/diagram PDF previews; extract text to verify all 65 stress-table rows, repeated headers, fallback content, and the final document marker.
- [x] Verify the deployed app contains the new parallel-generation UI after release.

The two-chapter end-to-end browser generation test ran against the local production build. Live release verification for the concurrency change checked deployment status, CI, and shipped client code; it did not repeat that entire browser generation test on Vercel.

## Published implementation milestones

- `9e97468` (2026-11-15): chapter validation/retries, tutor-focused prompts, session recovery, generation controls, and Windows PDF support.
- `563524f` (2026-11-16): formatted Markdown tables, Mermaid/ASCII PDF rendering, pagination fixes, embedded monospace font, and rendering tests.
- `15d6a7b` (2026-11-16): two concurrent chapter requests, independent progress, failure draining, duplicate-action guards, and queue tests.

Live app: https://learning-space-delta.vercel.app/

## Remaining work

### 1. Accounts, private storage, and book history

- [x] Choose Google sign-in using OpenID Connect on OAuth 2.0; request only `openid email profile`.
- [x] Implement and deploy Google sign-in/sign-out, encrypted sessions, a protected account page/API, and account-scoped browser workspaces through PR #1 (`e6290c7`).
- [x] Test identity/redirect/configuration rules and guest/user storage separation locally; test protected routes, encrypted app sessions, tampered/expired cookies, session updates, and CSRF-protected sign-out over HTTP using synthetic test sessions.
- [ ] Complete second-real-account switching and guest-book recovery checks; synthetic sessions cover distinct account keys but do not replace this browser test.
- [x] Create dedicated Google Cloud project/client and register exact localhost/production callbacks; verify real Google sign-in, profile/reload persistence, and sign-out/protected-page denial locally and on the deployed domain.
- [x] Save Google credentials and distinct local/production session secrets privately; merge to main, deploy, and verify main CI success.
- [ ] Complete Google publishing/branding requirements and verify access beyond the registered owner before public launch (currently External/Testing).
- [ ] Support both Google sign-in and self-service account creation; decide the registration method (for example, email/password) and include email verification and password recovery if passwords are supported.
- [ ] Persist both Google-authenticated and newly registered accounts as user records in PostgreSQL. Create or link a profile on a user's first Google sign-in, and use the database record as the durable account identity rather than relying on the browser session alone.
- [ ] For password-based registration, store only a secure password hash; never store or log plaintext passwords.
- [x] Choose PostgreSQL for the relational database design; hosting is not provisioned yet.
- [ ] Choose/provision private object storage for saved PDF/export files.
- [x] Design a PostgreSQL schema for profiles, folders, books, chapters, generation attempts, and private export metadata; add executable migration and isolated ownership/constraint checks in `db/` (not connected or deployed).
- [x] Step 1: add a forward migration to permanent UUID account IDs, separate Google identity mapping, and private optional password/verification/reset tables; verify populated-data migration and ownership isolation with 22 database checks. Registration endpoints and a hosted connection remain pending.
- [ ] Provision development PostgreSQL, apply the migration with a separate owner role, and configure a nonprivileged runtime connection.
- [ ] Connect verified Google identities to persistent profiles and implement transaction-scoped, ownership-checked book/chapter APIs before moving browser data into cloud storage.
- [ ] Associate every saved book/file with an authenticated owner and enforce ownership on every read/write/download.
- [ ] Add book history and fetch a user's saved books/files back into the UI.
- [ ] Decide how to import existing localStorage books into an account without losing local content.
- [ ] Test that user A cannot list or download user B's books, including direct file URLs.

There is currently no database shared by users, and the current Google sign-in implementation does not persist account records. In a typical account system, Google sign-in creates or finds a database user record on first sign-in, while self-service registration creates one; sessions then refer to that durable user identity. Password-based registration stores a password hash, not the password itself. localStorage belongs to the browser profile and website origin; it does not provide authenticated per-user ownership or multi-device sync. Generated PDFs are downloaded rather than stored in a durable backend.

### 2. Reliability and production readiness

- [ ] Add server-side rate limits, quotas, and cost controls; the client queue alone cannot enforce these.
- [ ] Distinguish configuration, authentication, quota, network, timeout, and provider errors in safe user-facing messages. The generic Gemini-key error still needs improvement.
- [ ] Add request IDs and structured diagnostics without logging credentials.
- [ ] Add request cancellation/timeouts and a cancel-generation UI.
- [ ] Handle localStorage quota/unavailable-storage failures without interrupting generation.
- [ ] Validate restored session data and test refresh recovery, corrupted storage, and origin/device limitations.
- [ ] Add a confirmation before clearing a book.
- [ ] Review dependency audit findings and plan compatible security upgrades.
- [ ] Add user counts/usage analytics with a defined privacy and retention policy.

### 3. Learning quality and version accuracy

- [ ] Review a full multi-chapter n8n book for repeated explanations, clear cross-chapter references, and reproducible learner steps.
- [ ] Run generated React/n8n examples against explicitly chosen versions; prompt guidance alone is not verification.
- [ ] Add source grounding/citations and a way to verify claims against current official documentation.
- [ ] Evaluate a shared curriculum/concept summary to reduce duplication while preserving parallel generation.
- [ ] Review Myanmar terminology, mixed-language artifacts, unclear analogies, and sentence quality across several books.
- [ ] Compare estimated page counts against actual content depth and exported PDF length.

### 4. Editing and publishing

- [ ] Add rendered Markdown preview and chapter editing before final assembly.
- [ ] Verify/fix table-of-contents links and exported heading anchors.
- [ ] Add code syntax highlighting, optional cover/metadata, and chapter page-break controls.
- [ ] Add EPUB export.
- [ ] Evaluate readability of very large diagrams that must shrink to fit one page.
- [ ] Extend rendering coverage to more diagram types, malformed tables, unusually long cells, and additional PDF viewers.

### 5. Additional regression coverage

- [ ] Add schema boundary tests and repeatable endpoint tests for invalid/malformed request bodies.
- [ ] Add controlled provider-failure tests for rate limits, network failures, token truncation, and incomplete AI content.
- [ ] Test manual regeneration failure, retry/resume after a partial batch, and storage persistence in the browser.
- [ ] Test keyboard navigation, accessible status announcements, reduced-motion behavior, and desktop/mobile layouts.
- [ ] Audit client bundles, responses, logs, and exported artifacts for accidental credential exposure.

## Product ideas to explore separately

These preserve the learner's notes; they are not completed features or a committed implementation sequence.

- [ ] Pre-discussion chat to refine a teaching idea or existing curriculum through clarifying questions, then produce a final book-generation prompt.
- [ ] PDF upload in that discussion flow for brainstorming and requirements gathering.
- [ ] An agent workflow driven by Markdown instructions for tutor-style book production.
- [ ] Optional connections to a user's other AI services/webhooks after authentication and secure credential storage are designed.
- [ ] Portfolio preparation, learner progress, quizzes, spaced repetition, collaboration, and personalized difficulty.

Original learner feedback and its review checklist remain in [priority prompt for coding.md](<priority prompt for coding.md>).
