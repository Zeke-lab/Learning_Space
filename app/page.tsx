"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import type { BookChapter, BookOutline, GeneratedChapter } from "@/types/book";

const DownloadPdfButton = dynamic(() => import("@/components/DownloadPdfButton"), { ssr: false });

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function compileBook(outline: BookOutline, chapters: GeneratedChapter[]) {
  const chapterMap = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));
  const contents = outline.tableOfContents.map((chapter) => `${chapter.chapterNumber}. [${chapter.chapterTitle}](#chapter-${chapter.chapterNumber}-${slugify(chapter.chapterTitle)})`).join("\n");
  const body = outline.tableOfContents.map((chapter) => chapterMap.get(chapter.chapterNumber)?.markdown ?? `## Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}\n\n_Not generated yet._`).join("\n\n---\n\n");
  return `# ${outline.bookTitle}\n\n_${outline.subtitle}_\n\nEstimated length: ${outline.estimatedTotalPages} pages\n\n## Table of Contents\n\n${contents}\n\n---\n\n${body}\n`;
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The deployed API route was not found. Redeploy the app as a Next.js server, not a static export.");
  }
  return response.json() as Promise<{ error?: string } & Record<string, unknown>>;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const [chapters, setChapters] = useState<GeneratedChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [error, setError] = useState("");
  const compiledBook = useMemo(() => (outline ? compileBook(outline, chapters) : ""), [outline, chapters]);

  async function handleOutlineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setOutline(null); setChapters([]); setActiveChapter(null);
    try {
      const response = await fetch("/api/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The outline could not be created.");
      setOutline(data as BookOutline);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The outline could not be created.");
    } finally { setLoading(false); }
  }

  function handleTopicKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function generateChapter(chapter: BookChapter) {
    if (!outline) return;
    setActiveChapter(chapter.chapterNumber); setError("");
    try {
      const nextChapter = outline.tableOfContents.find((candidate) => candidate.chapterNumber === chapter.chapterNumber + 1);
      const response = await fetch("/api/learn/chapter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookTitle: outline.bookTitle, chapter, nextChapterTitle: nextChapter?.chapterTitle }) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The chapter could not be generated.");
      setChapters((current) => [...current.filter((item) => item.chapterNumber !== chapter.chapterNumber), data as GeneratedChapter].sort((first, second) => first.chapterNumber - second.chapterNumber));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The chapter could not be generated.");
    } finally { setActiveChapter(null); }
  }

  function downloadBook() {
    const blob = new Blob([`\ufeff${compiledBook}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${slugify(outline?.bookTitle ?? "complete-book")}.md`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--ink)] text-sm font-bold text-[var(--paper)]">AB</span><span className="text-sm font-semibold tracking-[0.12em] text-[var(--ink)] uppercase">AI Book Studio</span></div><span className="text-xs font-medium tracking-[0.16em] text-[var(--muted)] uppercase">Outline to manuscript</span></header>
        <section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end lg:py-20"><div><p className="mb-4 text-xs font-bold tracking-[0.2em] text-[var(--accent)] uppercase">A complete technical guide, built in chapters</p><h1 className="max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-7xl">Turn one question into a book to devlop.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Generate the curriculum first. Then write each chapter with its foundations, mechanics, examples, and next steps intact.</p></div><aside className="border-l-2 border-[var(--accent)] pl-5 text-sm leading-6 text-[var(--muted)]"><p className="font-semibold text-[var(--ink)]">The book pipeline</p><p className="mt-2">Outline. Write sequentially. Assemble. Export.</p></aside></section>
        <form className="grid gap-4 border-y border-[var(--line)] py-5 md:grid-cols-[1fr_auto] md:items-end" onSubmit={handleOutlineSubmit}><div><label className="field-label" htmlFor="topic">What technical subject should become a book?</label><textarea className="field-input min-h-32 resize-y" id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={handleTopicKeyDown} placeholder="e.g. Vector Databases and RAG" maxLength={200} required /></div><button className="primary-button" type="submit" disabled={loading}>{loading ? "Building outline..." : "Generate outline"}</button></form>
        <div aria-live="polite" className="min-h-10 pt-4">{error && <p className="text-sm font-medium text-[var(--error)]">{error}</p>}</div>
        {outline ? <div className="pb-16">
          <section className="border-b border-[var(--line)] pb-12 pt-6"><p className="eyebrow">Master class</p><h2 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-6xl">{outline.bookTitle}</h2><p className="mt-5 max-w-2xl text-xl leading-8 text-[var(--muted)]">{outline.subtitle}</p><div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm font-semibold text-[var(--ink)]"><span>Estimated page count: <strong className="text-[var(--accent)]">{outline.estimatedTotalPages}</strong></span><span>Total chapters: <strong className="text-[var(--accent)]">{outline.tableOfContents.length}</strong></span><span>Generated: <strong className="text-[var(--accent)]">{chapters.length}/{outline.tableOfContents.length}</strong></span></div></section>
          <section className="pt-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Step 01</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Table of contents</h3></div>{chapters.length > 0 && <div className="flex flex-wrap gap-2"><button className="secondary-button" type="button" onClick={downloadBook}>Download Markdown</button><DownloadPdfButton bookTitle={outline.bookTitle} markdown={compiledBook} /></div>}</div><div className="chapter-table mt-6" role="table" aria-label="Book table of contents"><div className="chapter-table-head hidden md:grid" role="row"><span>Chapter</span><span>Title</span><span>Pages</span><span>Primary focus</span><span>Action</span></div>{outline.tableOfContents.map((chapter) => { const generated = chapters.some((item) => item.chapterNumber === chapter.chapterNumber); return <div className="chapter-row" key={chapter.chapterNumber} role="row"><span className="chapter-index">Chapter {chapter.chapterNumber}</span><div><h4 className="font-semibold text-[var(--ink)]">{chapter.chapterTitle}</h4><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{chapter.coreGoal}</p></div><span className="text-sm text-[var(--muted)]">{chapter.estimatedPages} pp.</span><span className="text-sm leading-6 text-[var(--muted)]">{chapter.sections[0]}</span><button className={generated ? "completed-button" : "secondary-button"} type="button" onClick={() => generateChapter(chapter)} disabled={activeChapter !== null}>{activeChapter === chapter.chapterNumber ? "Writing..." : generated ? "Regenerate" : "Write chapter"}</button></div>; })}</div></section>
          <section className="mt-12 border-t border-[var(--line)] pt-12"><p className="eyebrow">Step 03</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Complete manuscript</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">Your Markdown book assembles as chapters arrive. Unwritten chapters remain clearly marked until you generate them.</p><pre className="manuscript-preview mt-6 max-h-96 overflow-auto whitespace-pre-wrap">{compiledBook}</pre></section>
        </div> : <section className="empty-state pb-16" aria-label="How AI Book Studio works"><div className="empty-line" /><p className="eyebrow">A structured way to go deep</p><p className="mt-3 max-w-lg text-2xl leading-9 font-medium tracking-[-0.02em] text-[var(--ink)]">No 200-page prompt. Build the curriculum first, then let every chapter earn its place.</p></section>}
      </div>
    </main>
  );
}
