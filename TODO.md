# AI Book Studio TODO

## Product Direction

AI Book Studio turns one technical question into a structured, deep technical book.
It avoids asking an AI model to write a massive book in one response by splitting the work into a controlled pipeline:

`Topic -> Master outline -> Sequential chapters -> Markdown assembly -> PDF/eBook export`

The outline is generated first so the book has a coherent prerequisite-to-advanced progression. Chapters are generated one at a time and can be retried independently.

## MVP Scope

- [x] Enter a technical topic.
- [x] Generate a structured book title, subtitle, page estimate, and table of contents.
- [x] Show chapter number, title, page estimate, core goal, sections, and prerequisites.
- [x] Generate chapters individually from the outline.
- [x] Assemble generated chapters into `Complete_Book.md` content in the browser.
- [x] Download the assembled Markdown file.
- [ ] Persist the outline and chapters between browser sessions.
- [ ] Export the assembled Markdown to PDF or EPUB.

The MVP does not include authentication, payments, or a database.

## Architecture Decisions

- Framework: Next.js App Router.
- Language: TypeScript.
- Styling: Tailwind CSS with a book-editorial visual system.
- AI access: server-side API routes only.
- AI provider: Gemini through `@ai-sdk/google`.
- Output validation: Zod schemas with AI SDK structured output.
- Initial persistence: browser local storage.
- Assembly: deterministic Markdown generation from validated outline and chapter records.
- Export: Markdown download first; PDF/eBook conversion later.

## Phase 1: Project Foundation

- [x] Create the Next.js application with TypeScript, Tailwind, ESLint, and App Router.
- [x] Install `ai`, `zod`, `lucide-react`, and `@ai-sdk/google`.
- [x] Add `.env.local.example` with `GOOGLE_GENERATIVE_AI_API_KEY`.
- [x] Confirm lint, TypeScript, and production build support the app foundation.
- [ ] Add a real local `.env.local` API key without committing it.

## Phase 2: Book Data Contract

- [x] Define `BookChapter` with chapter number, title, page estimate, goal, sections, and prerequisites.
- [x] Define `BookOutline` with title, subtitle, total pages, and table of contents.
- [x] Define `GeneratedChapter` with chapter metadata and Markdown.
- [x] Validate outline responses with Zod.
- [x] Validate generated chapter responses with Zod.
- [ ] Add schema tests for missing fields, invalid page counts, and excessive chapter counts.

## Phase 3: Outline Generator

- [x] Create the master outline system prompt.
- [x] Require foundational chapters before core and advanced chapters.
- [x] Require strict structured output.
- [x] Create `POST /api/learn` as the outline endpoint.
- [x] Validate topic input and reject empty or excessively long topics.
- [x] Return safe errors without exposing provider details.
- [ ] Add a dedicated `/api/book/outline` route name if the API is separated from the earlier prototype route.
- [ ] Test outline generation with Vector Databases, Docker, and JavaScript async/await.

## Phase 4: Sequential Chapter Generator

- [x] Create the chapter-writing system prompt.
- [x] Include chapter title, goal, sections, prerequisites, estimated pages, and next chapter.
- [x] Require the four-part Markdown structure:
  - [ ] Chapter header, goal, and reading time.
  - [ ] Part I: foundational layer and analogies.
  - [ ] Part II: core concept, mechanics, comparison, ASCII diagram, and takeaways.
  - [ ] Part III: practical code or real-world example.
  - [ ] Part IV: recap and next chapter preview.
- [x] Create `POST /api/learn/chapter`.
- [x] Generate chapters independently so one failure does not discard the book outline.
- [ ] Add server-side rate limiting and retry/backoff handling.
- [ ] Add chapter output length limits appropriate for the selected model.

## Phase 5: Book Workspace UI

- [x] Replace the learning-node page with the AI Book Studio page.
- [x] Add topic search form.
- [x] Display book title, subtitle, estimated pages, chapter count, and generation progress.
- [x] Display the table of contents in a responsive chapter table.
- [x] Add an individual `Write chapter` action.
- [x] Show chapter generation state and completed state.
- [x] Display a live assembled Markdown manuscript.
- [x] Add a Markdown download action.
- [ ] Add chapter preview and editing before assembly.
- [ ] Add a sequential `Generate next chapter` action.
- [ ] Add a cancel action for long-running generation.

## Phase 6: Persistence and Assembly

- [ ] Define a `BookSession` storage shape.
- [ ] Save the outline to local storage after generation.
- [ ] Save each generated chapter to local storage.
- [ ] Restore the current book after refresh.
- [ ] Add a book history view.
- [ ] Add a clear-book action with confirmation.
- [x] Assemble title, subtitle, page estimate, Markdown TOC, and chapter content deterministically.
- [ ] Save the assembled result as `Complete_Book.md` in a server-side workspace when persistence is added.

## Phase 7: Publishing

- [ ] Add a Markdown preview mode.
- [ ] Add PDF export with a maintained converter or server-side rendering path.
- [ ] Add EPUB export.
- [ ] Add page-break controls between chapters.
- [ ] Add code syntax highlighting to published output.
- [ ] Add cover-page and metadata options.
- [ ] Verify generated links and chapter anchors in the exported document.

## Phase 8: Testing and Quality

- [x] Validate invalid outline requests return `400` before calling Gemini.
- [ ] Add unit tests for outline and chapter schemas.
- [ ] Add endpoint tests for invalid request bodies.
- [ ] Add tests for malformed AI output.
- [ ] Test outline generation, chapter regeneration, assembly, and download manually.
- [ ] Test keyboard-only navigation and visible focus states.
- [ ] Test mobile and desktop table layouts.
- [ ] Confirm no API key appears in client code or browser responses.
- [ ] Run lint, TypeScript, and production build before each milestone.

## Definition Of Done For MVP

The MVP is complete when a user can:

1. Enter a technical topic.
2. Receive a coherent multi-chapter outline.
3. Review the chapter goals, sections, prerequisites, and page estimates.
4. Generate chapters individually and retry a chapter without losing the outline.
5. See the assembled Markdown manuscript.
6. Download the result as a Markdown book.

## Deferred Enhancements

- Authentication and cloud book storage.
- Team collaboration and comments.
- Multiple AI providers.
- Citation and source management.
- Automatic fact checking.
- Chapter-level quizzes and learner progress.
- Visual graph navigation.
