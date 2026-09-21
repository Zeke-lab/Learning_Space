import { z } from "zod";

export const learnerLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const prerequisiteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  importance: z.enum(["required", "useful"]),
  reason: z.string().min(1),
  estimatedMinutes: z.number().int().positive().max(600),
});

export const learningResponseSchema = z.object({
  topic: z.string().min(1),
  level: learnerLevelSchema,
  overview: z.string().min(1),
  coreIdea: z.string().min(1),
  prerequisites: z.array(prerequisiteSchema).max(8),
  explanation: z.object({
    concept: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1).max(12),
    example: z.string().min(1),
    analogy: z.string().min(1).optional(),
    misconceptions: z.array(z.string().min(1)).max(8),
  }),
  checkQuestion: z.object({
    question: z.string().min(1),
    expectedIdea: z.string().min(1),
  }),
  recommendedNextNode: z.string().min(1),
});

export type LearningResponseInput = z.infer<typeof learningResponseSchema>;