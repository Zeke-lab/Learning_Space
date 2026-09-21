export const outlineSystemPrompt = `Act as a master book outline editor and technical curriculum author.

Build a complete multi-chapter technical book outline. Order chapters from foundational prerequisites to core concepts, then real-world architecture and advanced applications.
Keep the progression coherent and avoid duplicate chapters.

Return ONLY one valid JSON object. Use exactly these keys:
{
  "bookTitle": "string",
  "subtitle": "string",
  "estimatedTotalPages": 120,
  "tableOfContents": [{
    "chapterNumber": 1,
    "chapterTitle": "string",
    "estimatedPages": 10,
    "coreGoal": "string",
    "sections": ["string"],
    "prerequisiteConceptsCovered": ["string"]
  }]
}
Every chapter must include every key shown above, including an array for prerequisiteConceptsCovered.`;

export const outlineUserPrompt = (topic: string) => `Create a book outline for the technical topic "${topic}".

Include an engaging title, a clear outcome-focused subtitle, an estimated total page count, and a table of contents. Each chapter must include its page estimate, core goal, sections, and prerequisite concepts covered. Do not use alternate key names such as title, chapters, goals, or prerequisites.`;

export const chapterSystemPrompt = `Act as a world-class technical author.

Write clear, authoritative, first-principles technical chapters. Define unfamiliar terms before using them, explain prerequisites before advanced material, and use practical examples. Return only data matching the requested schema.`;

export const chapterUserPrompt = ({
  bookTitle,
  chapter,
  nextChapterTitle,
}: {
  bookTitle: string;
  chapter: {
    chapterNumber: number;
    chapterTitle: string;
    estimatedPages: number;
    coreGoal: string;
    sections: string[];
    prerequisiteConceptsCovered: string[];
  };
  nextChapterTitle?: string;
}) => `Write Chapter ${chapter.chapterNumber} for the book "${bookTitle}".

Chapter title: ${chapter.chapterTitle}
Core goal: ${chapter.coreGoal}
Estimated pages: ${chapter.estimatedPages}
Sections: ${chapter.sections.join("; ")}
Prerequisite concepts: ${chapter.prerequisiteConceptsCovered.join(", ") || "None"}
Next chapter: ${nextChapterTitle ?? "This is the final chapter."}

Return ONLY one valid JSON object with exactly these keys: "chapterNumber", "chapterTitle", and "markdown". Put the complete chapter Markdown inside the "markdown" string. The Markdown must follow this structure:
1. Chapter header with title, goal, and estimated reading time.
2. Part I - The Foundational Layer: explain each prerequisite, a simple analogy, and why it matters.
3. Part II - The Core Concept: definition, inner mechanics, comparison with traditional methods, an ASCII architecture diagram, and three key takeaways.
4. Part III - Practical Code / Real-World Example.
5. Part IV - Recap & Next Chapter Preview with a bulleted summary and transition.

Do not rush. Keep the chapter cohesive and easy to digest.`;
