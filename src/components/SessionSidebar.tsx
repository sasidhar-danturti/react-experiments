import { useMemo, useState } from 'react';
import type { SessionSummary } from '../types';
import './SessionSidebar.css';

interface SessionSidebarProps {
  sessions: SessionSummary[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const sortSessions = (sessions: SessionSummary[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: SessionSidebarProps) {
  const [draftTitle, setDraftTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const orderedSessions = useMemo(() => sortSessions(sessions), [sessions]);

  const handleCreateSession = () => {
    const trimmed = draftTitle.trim();
    onCreate(trimmed || 'New Strategy Report');
    setDraftTitle('');
  };

  const startEditing = (session: SessionSummary) => {
    setEditingId(session.id);
    setEditingValue(session.title);
  };

  const submitRename = () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (trimmed) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditingValue('');
  };

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <h1>Sessions</h1>
        <p className="sidebar__helper">Manage collaborative report workspaces.</p>
        <div className="sidebar__create">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="New session title"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleCreateSession();
              }
            }}
          />
          <button type="button" onClick={handleCreateSession}>
            Start
          </button>
        </div>
      </header>
      <nav className="sidebar__list" aria-label="Saved sessions">
        {orderedSessions.length === 0 && (
          <p className="sidebar__empty">Create your first session to begin.</p>
        )}
        {orderedSessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingId === session.id;
          return (
            <div
              key={session.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => onSelect(session.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSelect(session.id);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="sidebar__item-main">
                {isEditing ? (
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitRename();
                      }
                      if (event.key === 'Escape') {
                        setEditingId(null);
                        setEditingValue('');
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="sidebar__item-title">{session.title}</span>
                    <span className="sidebar__item-updated">
                      {new Date(session.updatedAt).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
              <div className="sidebar__item-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => startEditing(session)}>
                  Rename
                </button>
                <button type="button" onClick={() => onDelete(session.id)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
