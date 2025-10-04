export type AgentRole = 'user' | 'agent' | 'system';

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
}

export interface ConversationMessage {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}

export interface ReportSection {
  heading: string;
  bullets: string[];
}

export interface ReportArtifact {
  title: string;
  executiveSummary: string;
  sections: ReportSection[];
  recommendations: string[];
  nextSteps: string[];
  lastUpdated: string;
  revisionHistory: RevisionEntry[];
}

export interface RevisionEntry {
  timestamp: string;
  question: string;
  highlights: string;
}

export interface SessionDetail extends SessionSummary {
  messages: ConversationMessage[];
  report: ReportArtifact;
}

export interface InvokeAgentRequest {
  prompt: string;
  context?: string;
}

export interface InvokeAgentResponse {
  message: ConversationMessage;
  report: ReportArtifact;
  insights: string[];
}
