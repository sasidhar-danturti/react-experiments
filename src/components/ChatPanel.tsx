import { FormEvent, useMemo, useState } from 'react';
import type { ConversationMessage } from '../types';
import './ChatPanel.css';

interface ChatPanelProps {
  messages: ConversationMessage[];
  disabled?: boolean;
  onSend: (value: string) => Promise<void> | void;
  insights?: string[];
}

const roleLabels: Record<ConversationMessage['role'], string> = {
  user: 'You',
  agent: 'Agent',
  system: 'System'
};

export function ChatPanel({ messages, disabled, onSend, insights = [] }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Please enter a question or instruction.');
      return;
    }
    try {
      setError(null);
      await onSend(trimmed);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  return (
    <section className="chat-panel">
      <div className="chat-panel__history" aria-live="polite">
        {orderedMessages.length === 0 ? (
          <div className="chat-panel__empty">
            <h2>Start collaborating with the Databricks proxy agent</h2>
            <p>
              Upload evidence to the right, then ask strategic questions, request visuals, and iterate on
              high-impact reports. Each turn updates the intelligence deliverable.
            </p>
          </div>
        ) : (
          orderedMessages.map((message) => (
            <article key={message.id} className={`chat-message chat-message--${message.role}`}>
              <header>{roleLabels[message.role]}</header>
              <p>{message.content}</p>
              <time>{new Date(message.createdAt).toLocaleString()}</time>
            </article>
          ))
        )}
      </div>

      {insights.length > 0 && (
        <aside className="chat-panel__insights">
          <h3>Fresh Insights</h3>
          <ul>
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </aside>
      )}

      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the agent to refine analysis, add visuals, or explore a new angle..."
          disabled={disabled}
          rows={4}
        />
        {error && <p className="chat-panel__error">{error}</p>}
        <div className="chat-panel__actions">
          <button type="submit" disabled={disabled}>
            {disabled ? 'Thinking...' : 'Send to Agent'}
          </button>
        </div>
      </form>
    </section>
  );
}
