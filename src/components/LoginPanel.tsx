import { FormEvent, useState } from 'react';
import './LoginPanel.css';

interface LoginPanelProps {
  onLogin: (email: string, password: string, name?: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function LoginPanel({ onLogin, isLoading }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    try {
      setError(null);
      await onLogin(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="login-panel">
      <form className="login-panel__form" onSubmit={handleSubmit}>
        <h1>Authenticate to Continue</h1>
        <p>
          Sign in to manage your Databricks-powered analysis tasks. Accounts are provisioned automatically on
          first login.
        </p>
        <label>
          <span>Name (optional)</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" />
        </label>
        <label>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="analyst@example.com"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Enter a secure passphrase"
            required
          />
        </label>
        {error && <p className="login-panel__error">{error}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Enter Workspace'}
        </button>
      </form>
    </div>
  );
}
