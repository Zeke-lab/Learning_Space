export type BookChapter = {
  chapterNumber: number;
  chapterTitle: string;
  estimatedPages: number;
  coreGoal: string;
  sections: string[];
  prerequisiteConceptsCovered: string[];
};

export type BookOutline = {
  bookTitle: string;
  subtitle: string;
  estimatedTotalPages: number;
  tableOfContents: BookChapter[];
};

export type GeneratedChapter = {
  chapterNumber: number;
  chapterTitle: string;
  markdown: string;
};