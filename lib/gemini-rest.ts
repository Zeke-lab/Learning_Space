import { z } from "zod";

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const fallbackModels = [
  geminiModel,
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
].filter((model, index, models) => models.indexOf(model) === index);

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

function parseJson(text: string) {
  const normalized = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    for (let start = normalized.indexOf("{"); start >= 0; start = normalized.indexOf("{", start + 1)) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < normalized.length; index += 1) {
        const character = normalized[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{") depth += 1;
        else if (character === "}") {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(normalized.slice(start, index + 1)) as unknown;
            } catch {
              break;
            }
          }
        }
      }
    }
    throw new Error("Gemini returned invalid JSON.");
  }
}

export async function generateGeminiJson<T>(system: string, prompt: string, schema: z.ZodType<T>) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing.");
  }

  const request = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  };

  let response: Response | undefined;
  for (const model of fallbackModels) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        request,
      );
      if (response.ok || !retryableStatuses.has(response.status) || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
    }
    if (response?.ok || (response && !retryableStatuses.has(response.status))) break;
  }

  if (!response) throw new Error("Gemini did not return a response.");

  if (!response.ok) {
    const providerError = await response.text();
    throw new Error(
      retryableStatuses.has(response.status)
        ? "Gemini is temporarily busy. Please try again in a moment."
        : `Gemini request failed (${response.status}): ${providerError}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");

  return schema.parse(parseJson(text));
}
