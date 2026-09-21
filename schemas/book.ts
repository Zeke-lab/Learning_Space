import { z } from "zod";

export const bookChapterSchema = z.object({
  chapterNumber: z.number().int().positive(),
  chapterTitle: z.string().min(1),
  estimatedPages: z.number().int().positive().max(200),
  coreGoal: z.string().min(1),
  sections: z.array(z.string().min(1)).min(1).max(12),
  prerequisiteConceptsCovered: z.array(z.string().min(1)).max(12),
});

export const bookOutlineSchema = z.object({
  bookTitle: z.string().min(1),
  subtitle: z.string().min(1),
  estimatedTotalPages: z.number().int().positive().max(2_000),
  tableOfContents: z.array(bookChapterSchema).min(1).max(20),
});

export const generatedChapterSchema = z.object({
  chapterNumber: z.coerce.number().int().positive(),
  chapterTitle: z.string().min(1),
  markdown: z.string().min(1),
});