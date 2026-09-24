import { NextResponse } from "next/server";
import { z } from "zod";

import { bookOutlineSchema } from "@/schemas/book";
import { generateGeminiJson } from "@/lib/gemini-rest";
import { outlineSystemPrompt, outlineUserPrompt } from "@/lib/prompts";

const requestSchema = z.object({
  topic: z.string().trim().min(1).max(10_000),
});

export async function POST(request: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY is missing. Add it to .env.local and restart the dev server." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsedRequest = requestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "Enter a book topic to continue." },
        { status: 400 },
      );
    }

    const { topic } = parsedRequest.data;
    const result = await generateGeminiJson(
      outlineSystemPrompt,
      outlineUserPrompt(topic),
      bookOutlineSchema,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Outline generation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("temporarily busy")
            ? error.message
            : "The book outline could not be created. Check your Gemini API key and try again.",
      },
      { status: 500 },
    );
  }
}
