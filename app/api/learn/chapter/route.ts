import { NextResponse } from "next/server";
import { z } from "zod";

import {
  bookChapterSchema,
  generatedChapterSchema,
  hasCompleteChapterSections,
  minimumChapterMarkdownLength,
} from "@/schemas/book";
import { generateGeminiJson } from "@/lib/gemini-rest";
import { chapterSystemPrompt, chapterUserPrompt } from "@/lib/prompts";

const requestSchema = z.object({
  bookTitle: z.string().trim().min(1).max(300),
  chapter: bookChapterSchema,
  nextChapterTitle: z.string().trim().max(300).optional(),
});

const MAX_CONTENT_ATTEMPTS = 3;

const generatedChapterResponseSchema = {
  type: "OBJECT",
  properties: {
    chapterNumber: { type: "INTEGER" },
    chapterTitle: { type: "STRING" },
    markdown: { type: "STRING" },
  },
  required: ["chapterNumber", "chapterTitle", "markdown"],
};

function getChapterIssues(
  result: z.infer<typeof generatedChapterSchema>,
  chapter: z.infer<typeof bookChapterSchema>,
  minimumLength: number,
) {
  const issues: string[] = [];
  if (result.chapterNumber !== chapter.chapterNumber || result.chapterTitle !== chapter.chapterTitle) {
    issues.push("the returned chapter number or title did not match the outline");
  }
  if (result.markdown.trim().length < minimumLength) {
    issues.push(`the response was too short (${result.markdown.trim().length} characters; at least ${minimumLength} required)`);
  }
  if (!hasCompleteChapterSections(result.markdown)) {
    issues.push("one or more required Parts I–IV headings were missing");
  }
  return issues;
}

function isMalformedContentError(error: unknown) {
  return (
    error instanceof z.ZodError ||
    (error instanceof Error &&
      (error.message.includes("Gemini returned invalid JSON") ||
        error.message.includes("Gemini returned no content") ||
        error.message.includes("response reached its output-token limit")))
  );
}

export async function POST(request: Request) {
  try {
    const parsedRequest = requestSchema.safeParse(await request.json());

    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "The chapter request is incomplete or invalid." },
        { status: 400 },
      );
    }

    const { bookTitle, chapter, nextChapterTitle } = parsedRequest.data;
    const minimumLength = minimumChapterMarkdownLength(chapter.estimatedPages);
    let retryFeedback: string | undefined;
    let previousDraft: string | undefined;
    let lastIssues = "";

    for (let attempt = 1; attempt <= MAX_CONTENT_ATTEMPTS; attempt += 1) {
      let result: z.infer<typeof generatedChapterSchema>;
      try {
        result = await generateGeminiJson(
          chapterSystemPrompt,
          chapterUserPrompt({
            bookTitle,
            chapter,
            nextChapterTitle,
            minimumMarkdownLength: minimumLength,
            retryFeedback,
            previousDraft,
          }),
          generatedChapterSchema,
          generatedChapterResponseSchema,
        );
      } catch (error) {
        if (!isMalformedContentError(error)) throw error;
        lastIssues = error instanceof z.ZodError
          ? "Gemini's response did not match the required chapter format"
          : error instanceof Error
            ? error.message
            : "Gemini returned malformed chapter content";
        retryFeedback = lastIssues;
        console.warn(`Chapter ${chapter.chapterNumber} response was malformed (attempt ${attempt}/${MAX_CONTENT_ATTEMPTS}).`);
        continue;
      }

      const issues = getChapterIssues(result, chapter, minimumLength);
      if (issues.length === 0) {
        return NextResponse.json(result);
      }

      lastIssues = issues.join("; ");
      retryFeedback = lastIssues;
      previousDraft = result.markdown.trim().length < minimumLength ? result.markdown : undefined;
      console.warn(`Chapter ${chapter.chapterNumber} was incomplete (attempt ${attempt}/${MAX_CONTENT_ATTEMPTS}): ${lastIssues}`);
    }

    return NextResponse.json(
      {
        error: `Gemini could not produce a complete chapter after ${MAX_CONTENT_ATTEMPTS} attempts. Last issue: ${lastIssues}. The chapter was not saved; retry to try again.`,
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("Chapter generation failed", error);
    if (isMalformedContentError(error)) {
      return NextResponse.json(
        { error: "Gemini returned incomplete chapter content. The chapter was not saved; please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("temporarily busy")
            ? error.message
            : "The chapter could not be generated. Check your Gemini API key and try again.",
      },
      { status: 500 },
    );
  }
}