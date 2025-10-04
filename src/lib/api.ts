import type {
  InvokeAgentRequest,
  InvokeAgentResponse,
  SessionDetail,
  SessionSummary,
  ReportArtifact
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unexpected API error');
  }
  return response.json() as Promise<T>;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  return handleResponse<SessionSummary[]>(res);
}

export async function createSession(title: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  return handleResponse<SessionDetail>(res);
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  return handleResponse<SessionDetail>(res);
}

export async function renameSession(id: string, title: string): Promise<SessionSummary> {
  const res = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  return handleResponse<SessionSummary>(res);
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Failed to delete session');
  }
}

export async function invokeAgent(
  id: string,
  payload: InvokeAgentRequest
): Promise<InvokeAgentResponse> {
  const res = await fetch(`${API_BASE}/sessions/${id}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<InvokeAgentResponse>(res);
}

export async function persistReport(
  id: string,
  report: ReportArtifact
): Promise<ReportArtifact> {
  const res = await fetch(`${API_BASE}/sessions/${id}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
  return handleResponse<ReportArtifact>(res);
}
