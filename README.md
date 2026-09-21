This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.





Based on the current implementation, the app’s main strength is that it turns AI from a question-answering tool into a structured book-building system.

Advantages over a general AI chat tool

Coherent learning progression: It generates a complete outline first, moving from prerequisites to core concepts and advanced applications.
Less fragmented learning: Instead of isolated answers across many chats, chapters share one book structure, title, goals, sections, and next-chapter context.
Deeper explanations: Each chapter is prompted to include foundations, analogies, mechanics, comparisons, diagrams, practical code, takeaways, and a recap.
User control: Learners choose which chapters to generate and can regenerate individual chapters without losing the rest of the book.
A reusable learning artifact: The result becomes a downloadable Markdown book rather than disappearing in a chat history.
More reliable structure: Zod validation ensures generated outlines and chapters follow the expected schema.
Lower cognitive overload: The learner can see the full curriculum, estimated pages, chapter goals, prerequisites, and generation progress before diving in.
Efficient generation: Large books are created chapter by chapter instead of relying on one unreliable massive AI response.
These strengths are visible in the outline and chapter pipeline, curriculum prompts, validated book schemas, and book workspace UI.

Advantages over conventional learning tools

Compared with courses, textbooks, or platforms like flashcard apps, this app offers:

Topic-specific books generated on demand
Faster adaptation to unusual or highly technical subjects
A single workflow from question to curriculum to manuscript
More flexibility than a fixed course syllabus
Easier exporting and personal ownership of the material
Where it is not stronger yet

The current MVP does not yet provide:

Persistent learner progress
Spaced repetition
Quizzes or assessments
Citations and source verification
Human expert review
Personalized difficulty adjustment
PDF or EPUB export
Chapter editing before final assembly
So the strongest positioning is:

AI Book Studio is not primarily an AI tutor or a course platform. It is a tool for turning a technical learning goal into a coherent, personalized reference book.

Its biggest future advantage would come from combining the current book-generation workflow with quizzes, progress tracking, citations, spaced repetition, and learner-level personalization.