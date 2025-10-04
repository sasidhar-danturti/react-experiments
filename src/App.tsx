import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { DocumentManager } from './components/DocumentManager';
import { LoginPanel } from './components/LoginPanel';
import { ReportPanel } from './components/ReportPanel';
import { TaskSidebar } from './components/TaskSidebar';
import {
  createTask,
  deleteTask,
  downloadDocument,
  downloadReportPdf,
  fetchTask,
  fetchTasks,
  invokeAgent,
  listDocuments,
  login,
  persistReport,
  renameTask,
  uploadDocument
} from './lib/api';
import type {
  DocumentRecord,
  ReportArtifact,
  TaskDetail,
  TaskSummary,
  UserProfile
} from './types';
import './App.css';

const TOKEN_KEY = 'databricks-workspace-token';
const USER_KEY = 'databricks-workspace-user';

function downloadMarkdown(report: ReportArtifact) {
  const sections = report.sections
    .map((section) => `## ${section.heading}\n${section.bullets.map((bullet) => `- ${bullet}`).join('\n')}`)
    .join('\n\n');
  const recommendations = report.recommendations.map((line) => `- ${line}`).join('\n');
  const steps = report.nextSteps.map((line, index) => `${index + 1}. ${line}`).join('\n');
  const revisions = report.revisionHistory
    .map((entry) => `- ${new Date(entry.timestamp).toLocaleString()}: ${entry.highlights}`)
    .join('\n');
  const markdown = `# ${report.title}\n\n**Last Updated:** ${new Date(report.lastUpdated).toLocaleString()}\n\n## Executive Summary\n${report.executiveSummary}\n\n${sections}\n\n## Recommendations\n${recommendations}\n\n## Next Steps\n${steps}\n\n## Revision History\n${revisions}`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function useWorkspace(token: string | null) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [activeTask, setActiveTask] = useState<TaskDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  const refreshDocuments = useCallback(async () => {
    if (!token) return;
    const list = await listDocuments(token);
    setDocuments(list);
  }, [token]);

  const loadTasks = useCallback(async () => {
    if (!token) {
      setTasks([]);
      return;
    }
    const list = await fetchTasks(token);
    setTasks(list);
  }, [token]);

  const selectTask = useCallback(
    async (id: string) => {
      if (!token) return;
      setIsThinking(true);
      try {
        const detail = await fetchTask(token, id);
        setActiveTask(detail);
        setInsights([]);
      } finally {
        setIsThinking(false);
      }
    },
    [token]
  );

  const createNewTask = useCallback(
    async (title: string) => {
      if (!token) return;
      setIsThinking(true);
      try {
        const created = await createTask(token, title);
        await loadTasks();
        setActiveTask(created);
      } finally {
        setIsThinking(false);
      }
    },
    [token, loadTasks]
  );

  const updateTaskTitle = useCallback(
    async (id: string, title: string) => {
      if (!token) return;
      await renameTask(token, id, title);
      await loadTasks();
      setActiveTask((current) => (current && current.id === id ? { ...current, title } : current));
    },
    [token, loadTasks]
  );

  const removeTask = useCallback(
    async (id: string) => {
      if (!token) return;
      await deleteTask(token, id);
      await loadTasks();
      const wasActive = activeTask?.id === id;
      setActiveTask((current) => (current && current.id === id ? null : current));
      if (wasActive) {
        setInsights([]);
      }
    },
    [token, loadTasks, activeTask]
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!token || !activeTask) return;
      setIsThinking(true);
      try {
        const response = await invokeAgent(token, activeTask.id, { prompt });
        setInsights(response.insights);
        const refreshed = await fetchTask(token, activeTask.id);
        setActiveTask(refreshed);
        await loadTasks();
        await refreshDocuments();
      } finally {
        setIsThinking(false);
      }
    },
    [token, activeTask, loadTasks, refreshDocuments]
  );

  const saveReport = useCallback(
    async (report: ReportArtifact) => {
      if (!token || !activeTask) return;
      await persistReport(token, activeTask.id, report);
      const refreshed = await fetchTask(token, activeTask.id);
      setActiveTask(refreshed);
      await loadTasks();
    },
    [token, activeTask, loadTasks]
  );

  const downloadActiveReportPdf = useCallback(async () => {
    if (!token || !activeTask) return;
    const blob = await downloadReportPdf(token, activeTask.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTask.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [token, activeTask]);

  const uploadEvidence = useCallback(
    async (file: File) => {
      if (!token) return;
      setIsUploading(true);
      try {
        await uploadDocument(token, file);
        await refreshDocuments();
      } finally {
        setIsUploading(false);
      }
    },
    [token, refreshDocuments]
  );

  const downloadEvidence = useCallback(
    async (doc: DocumentRecord) => {
      if (!token) return;
      const blob = await downloadDocument(token, doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setTasks([]);
      setActiveTask(null);
      setDocuments([]);
      setInsights([]);
      return;
    }
    loadTasks().catch(() => undefined);
    refreshDocuments().catch(() => undefined);
    const interval = setInterval(() => {
      refreshDocuments().catch(() => undefined);
    }, 4000);
    return () => clearInterval(interval);
  }, [token, loadTasks, refreshDocuments]);

  return {
    tasks,
    activeTask,
    documents,
    isThinking,
    isUploading,
    insights,
    selectTask,
    createNewTask,
    updateTaskTitle,
    removeTask,
    sendMessage,
    saveReport,
    downloadActiveReportPdf,
    uploadEvidence,
    downloadEvidence,
    refreshDocuments
  };
}

function EmptyState() {
  return (
    <div className="app__empty">
      <h2>Select or create a task</h2>
      <p>
        Each task keeps the authenticated conversation, ingestion results, and the evolving report so your team can
        revisit insights later.
      </p>
    </div>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as UserProfile) : null;
  });
  const [authenticating, setAuthenticating] = useState(false);

  const workspace = useWorkspace(token);

  const handleLogin = useCallback(
    async (email: string, password: string, name?: string) => {
      setAuthenticating(true);
      try {
        const response = await login(email, password, name);
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      } finally {
        setAuthenticating(false);
      }
    },
    []
  );

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const layoutClass = useMemo(
    () => (workspace.activeTask ? 'app__main' : 'app__main app__main--empty'),
    [workspace.activeTask]
  );

  if (!token || !user) {
    return <LoginPanel onLogin={handleLogin} isLoading={authenticating} />;
  }

  return (
    <div className="app">
      <TaskSidebar
        tasks={workspace.tasks}
        activeTaskId={workspace.activeTask?.id}
        onSelect={workspace.selectTask}
        onCreate={workspace.createNewTask}
        onRename={workspace.updateTaskTitle}
        onDelete={workspace.removeTask}
      />

      <main className={layoutClass}>
        {workspace.activeTask ? (
          <>
            <section className="app__column app__column--chat">
              <div className="app__task-header">
                <div>
                  <h2>{workspace.activeTask.title}</h2>
                  <p>
                    Task created {new Date(workspace.activeTask.createdAt).toLocaleString()} — signed in as {user.name}{' '}
                    ({user.email})
                  </p>
                </div>
                <div className="app__header-actions">
                  <span className={`app__status ${workspace.isThinking ? 'app__status--thinking' : 'app__status--idle'}`}>
                    {workspace.isThinking ? 'Agent thinking' : 'Ready'}
                  </span>
                  <button type="button" className="app__logout" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              </div>
              <ChatPanel
                messages={workspace.activeTask.messages}
                onSend={workspace.sendMessage}
                disabled={workspace.isThinking}
                insights={workspace.insights}
              />
            </section>
            <section className="app__column app__column--right">
              <DocumentManager
                documents={workspace.documents}
                onUpload={workspace.uploadEvidence}
                onDownload={workspace.downloadEvidence}
                isUploading={workspace.isUploading}
              />
              <ReportPanel
                report={workspace.activeTask.report}
                disabled={workspace.isThinking}
                onDownloadMarkdown={downloadMarkdown}
                onDownloadPdf={() => void workspace.downloadActiveReportPdf()}
              />
            </section>
          </>
        ) : (
          <div className="app__welcome">
            <header className="app__welcome-header">
              <div>
                <h2>Welcome back, {user.name}</h2>
                <p>Launch a new intelligence task or pick up where you left off.</p>
              </div>
              <button type="button" className="app__logout" onClick={handleLogout}>
                Sign out
              </button>
            </header>
            <EmptyState />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
