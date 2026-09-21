import { NextResponse } from "next/server";
import { z } from "zod";

import { bookChapterSchema, generatedChapterSchema } from "@/schemas/book";
import { generateGeminiJson } from "@/lib/gemini-rest";
import { chapterSystemPrompt, chapterUserPrompt } from "@/lib/prompts";

const requestSchema = z.object({
  bookTitle: z.string().trim().min(1).max(300),
  chapter: bookChapterSchema,
  nextChapterTitle: z.string().trim().max(300).optional(),
});

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
    const result = await generateGeminiJson(
      chapterSystemPrompt,
      chapterUserPrompt({ bookTitle, chapter, nextChapterTitle }),
      generatedChapterSchema,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chapter generation failed", error);
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