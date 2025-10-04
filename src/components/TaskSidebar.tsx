import { useMemo, useState } from 'react';
import type { TaskSummary } from '../types';
import './TaskSidebar.css';

interface TaskSidebarProps {
  tasks: TaskSummary[];
  activeTaskId?: string;
  onSelect: (id: string) => Promise<void> | void;
  onCreate: (title: string) => Promise<void> | void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

const sortTasks = (tasks: TaskSummary[]) =>
  [...tasks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export function TaskSidebar({
  tasks,
  activeTaskId,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: TaskSidebarProps) {
  const [draftTitle, setDraftTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const orderedTasks = useMemo(() => sortTasks(tasks), [tasks]);

  const handleCreateTask = () => {
    const trimmed = draftTitle.trim();
    void onCreate(trimmed || 'New Intelligence Task');
    setDraftTitle('');
  };

  const startEditing = (task: TaskSummary) => {
    setEditingId(task.id);
    setEditingValue(task.title);
  };

  const submitRename = () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (trimmed) {
      void onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditingValue('');
  };

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <h1>Tasks</h1>
        <p className="sidebar__helper">Manage authenticated intelligence chats and deliverables.</p>
        <div className="sidebar__create">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="New task title"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleCreateTask();
              }
            }}
          />
          <button type="button" onClick={handleCreateTask}>
            Create
          </button>
        </div>
      </header>
      <nav className="sidebar__list" aria-label="Saved tasks">
        {orderedTasks.length === 0 && (
          <p className="sidebar__empty">Create your first task to begin collaborating.</p>
        )}
        {orderedTasks.map((task) => {
          const isActive = task.id === activeTaskId;
          const isEditing = editingId === task.id;
          return (
            <div
              key={task.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => void onSelect(task.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void onSelect(task.id);
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
                    <span className="sidebar__item-title">{task.title}</span>
                    <span className="sidebar__item-updated">
                      {new Date(task.updatedAt).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
              <div className="sidebar__item-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => startEditing(task)}>
                  Rename
                </button>
                <button type="button" onClick={() => void onDelete(task.id)}>
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
