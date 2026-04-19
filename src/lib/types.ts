export type ScoreDimension = "clarity" | "simplicity" | "patience" | "warmth" | "fluency";

export type TranscriptTurn =
  | { role: "assistant"; text: string; at: number }
  | { role: "user"; text: string; at: number };

export type InterviewState = {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  currentQuestionIndex: number;
  followUpCount: number;
  maxFollowUpsPerQuestion: number;
  questions: string[];
  transcript: TranscriptTurn[];
  targetClass?: string;
  done: boolean;
};

export type InterviewStepResult =
  | {
      action: "retry";
      assistantText: string;
      reason: string;
    }
  | {
      action: "followup" | "next";
      assistantText: string;
      reason: string;
      flags: {
        vague: boolean;
        tooComplex: boolean;
        lowEmpathy: boolean;
        offTopic: boolean;
        strong: boolean;
        tooShort: boolean;
        tooLong: boolean;
      };
    }
  | {
      action: "end";
      assistantText: string;
      reason: string;
    };

export type EvaluationReport = {
  scores: Record<ScoreDimension, number>;
  strengths: string[];
  improvements: string[];
  evidence: string[];
  ideal_answers: string[];
  final_decision: "PASS" | "REJECT";
  key_insights?: string[];
  transcript?: TranscriptTurn[];
};

