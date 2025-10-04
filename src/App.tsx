import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { ReportPanel } from './components/ReportPanel';
import { SessionSidebar } from './components/SessionSidebar';
import {
  createSession,
  deleteSession,
  fetchSession,
  fetchSessions,
  invokeAgent,
  persistReport,
  renameSession
} from './lib/api';
import type { ReportArtifact, SessionDetail, SessionSummary } from './types';
import './App.css';

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

function useSessionsManager() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  const loadSessions = useCallback(async () => {
    const list = await fetchSessions();
    setSessions(list);
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const session = await fetchSession(id);
      setActiveSession(session);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewSession = useCallback(async (title: string) => {
    setIsLoading(true);
    try {
      const session = await createSession(title);
      await loadSessions();
      setActiveSession(session);
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  const updateSessionTitle = useCallback(
    async (id: string, title: string) => {
      await renameSession(id, title);
      await loadSessions();
      if (activeSession?.id === id) {
        setActiveSession({ ...activeSession, title });
      }
    },
    [activeSession, loadSessions]
  );

  const removeSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      await loadSessions();
      if (activeSession?.id === id) {
        setActiveSession(null);
      }
    },
    [activeSession, loadSessions]
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!activeSession) return;
      setIsLoading(true);
      try {
        const response = await invokeAgent(activeSession.id, { prompt });
        setInsights(response.insights);
        const refreshed = await fetchSession(activeSession.id);
        setActiveSession(refreshed);
        await loadSessions();
      } finally {
        setIsLoading(false);
      }
    },
    [activeSession, loadSessions]
  );

  const saveReport = useCallback(
    async (report: ReportArtifact) => {
      if (!activeSession) return;
      await persistReport(activeSession.id, report);
      const refreshed = await fetchSession(activeSession.id);
      setActiveSession(refreshed);
      await loadSessions();
    },
    [activeSession, loadSessions]
  );

  return {
    sessions,
    activeSession,
    isLoading,
    insights,
    loadSessions,
    selectSession,
    createNewSession,
    updateSessionTitle,
    removeSession,
    sendMessage,
    saveReport
  };
}

function EmptyState() {
  return (
    <div className="app__empty">
      <h2>Select or create a session</h2>
      <p>
        Each workspace keeps the full conversation, agentic reasoning, and the evolving report so your
        team can revisit insights later.
      </p>
    </div>
  );
}

function App() {
  const {
    sessions,
    activeSession,
    isLoading,
    insights,
    loadSessions,
    selectSession,
    createNewSession,
    updateSessionTitle,
    removeSession,
    sendMessage
  } = useSessionsManager();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const layoutClass = useMemo(() => (activeSession ? 'app__main' : 'app__main app__main--empty'), [activeSession]);

  return (
    <div className="app">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelect={selectSession}
        onCreate={createNewSession}
        onRename={updateSessionTitle}
        onDelete={removeSession}
      />

      <main className={layoutClass}>
        {activeSession ? (
          <>
            <section className="app__column">
              <div className="app__session-header">
                <div>
                  <h2>{activeSession.title}</h2>
                  <p>Session created {new Date(activeSession.createdAt).toLocaleString()}</p>
                </div>
                <span className={`app__status ${isLoading ? 'app__status--thinking' : 'app__status--idle'}`}>
                  {isLoading ? 'Agent thinking' : 'Ready'}
                </span>
              </div>
              <ChatPanel messages={activeSession.messages} onSend={sendMessage} disabled={isLoading} insights={insights} />
            </section>
            <section className="app__column app__column--report">
              <ReportPanel report={activeSession.report} disabled={isLoading} onDownload={downloadMarkdown} />
            </section>
          </>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

export default App;
