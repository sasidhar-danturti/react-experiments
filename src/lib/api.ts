import type {
  AuthResponse,
  DocumentRecord,
  InvokeAgentRequest,
  InvokeAgentResponse,
  ReportArtifact,
  TaskDetail,
  TaskSummary
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unexpected API error');
  }
  return response.json() as Promise<T>;
}

function withAuth(token: string, extra: Record<string, string> = {}) {
  return {
    'x-user-id': token,
    ...extra
  } satisfies Record<string, string>;
}

export async function login(email: string, password: string, name?: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  return handleResponse<AuthResponse>(res);
}

export async function fetchTasks(token: string): Promise<TaskSummary[]> {
  const res = await fetch(`${API_BASE}/tasks`, {
    headers: withAuth(token)
  });
  return handleResponse<TaskSummary[]>(res);
}

export async function createTask(token: string, title: string): Promise<TaskDetail> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: withAuth(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title })
  });
  return handleResponse<TaskDetail>(res);
}

export async function fetchTask(token: string, id: string): Promise<TaskDetail> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    headers: withAuth(token)
  });
  return handleResponse<TaskDetail>(res);
}

export async function renameTask(token: string, id: string, title: string): Promise<TaskSummary> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: withAuth(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title })
  });
  return handleResponse<TaskSummary>(res);
}

export async function deleteTask(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
    headers: withAuth(token)
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Failed to delete task');
  }
}

export async function invokeAgent(
  token: string,
  id: string,
  payload: InvokeAgentRequest
): Promise<InvokeAgentResponse> {
  const res = await fetch(`${API_BASE}/tasks/${id}/invoke`, {
    method: 'POST',
    headers: withAuth(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse<InvokeAgentResponse>(res);
}

export async function persistReport(
  token: string,
  id: string,
  report: ReportArtifact
): Promise<ReportArtifact> {
  const res = await fetch(`${API_BASE}/tasks/${id}/report`, {
    method: 'PUT',
    headers: withAuth(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(report)
  });
  return handleResponse<ReportArtifact>(res);
}

export async function downloadReportPdf(token: string, id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tasks/${id}/report/pdf`, {
    headers: withAuth(token)
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Failed to download report');
  }
  return res.blob();
}

export async function listDocuments(token: string): Promise<DocumentRecord[]> {
  const res = await fetch(`${API_BASE}/documents`, {
    headers: withAuth(token)
  });
  return handleResponse<DocumentRecord[]>(res);
}

export async function uploadDocument(token: string, file: File): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: withAuth(token),
    body: formData
  });
  return handleResponse<DocumentRecord>(res);
}

export async function downloadDocument(token: string, id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: withAuth(token)
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Failed to download document');
  }
  return res.blob();
}
