export type AgentRole = 'user' | 'agent' | 'system';

export interface TaskSummary {
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

export interface TaskDetail extends TaskSummary {
  messages: ConversationMessage[];
  report: ReportArtifact;
}

export interface DocumentRecord {
  id: string;
  originalName: string;
  storedName: string;
  uploadedAt: string;
  size: number;
  status: 'processing' | 'processed' | 'failed';
  notes?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
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
