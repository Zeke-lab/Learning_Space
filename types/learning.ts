export type LearnerLevel = "beginner" | "intermediate" | "advanced";

export type Prerequisite = {
  id: string;
  title: string;
  importance: "required" | "useful";
  reason: string;
  estimatedMinutes: number;
};

export type LearningExplanation = {
  concept: string;
  steps: string[];
  example: string;
  analogy?: string;
  misconceptions: string[];
};

export type UnderstandingCheck = {
  question: string;
  expectedIdea: string;
};

export type LearningResponse = {
  topic: string;
  level: LearnerLevel;
  overview: string;
  coreIdea: string;
  prerequisites: Prerequisite[];
  explanation: LearningExplanation;
  checkQuestion: UnderstandingCheck;
  recommendedNextNode: string;
};

export type LearningNode = {
  id: string;
  title: string;
  status: "not-started" | "learning" | "understood" | "review";
  lesson?: LearningResponse;
};