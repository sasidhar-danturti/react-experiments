import { ChangeEvent, useRef, useState } from 'react';
import type { DocumentRecord } from '../types';
import './DocumentManager.css';

interface DocumentManagerProps {
  documents: DocumentRecord[];
  onUpload: (file: File) => Promise<void> | void;
  onDownload: (doc: DocumentRecord) => Promise<void> | void;
  isUploading?: boolean;
}

export function DocumentManager({ documents, onUpload, onDownload, isUploading }: DocumentManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = documents.length
    ? `${documents.length} uploaded file${documents.length === 1 ? '' : 's'} ready for reference.`
    : 'Upload supporting material for the ingestion agent.';

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <section className="document-manager">
      <header className="document-manager__header">
        <div>
          <h2>Evidence</h2>
          <p>{summary}</p>
        </div>
        <button
          type="button"
          className="document-manager__upload"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading…' : 'Upload Document'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="document-manager__input"
          onChange={handleFileChange}
          aria-label="Upload document"
        />
      </header>

      {error && <p className="document-manager__error">{error}</p>}

      <ul className="document-manager__list">
        {documents.length === 0 ? (
          <li className="document-manager__empty">No documents uploaded yet.</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="document-manager__item">
              <div className="document-manager__meta">
                <h3>{doc.originalName}</h3>
                <p>
                  Uploaded {new Date(doc.uploadedAt).toLocaleString()} — {(doc.size / 1024).toFixed(1)} KB
                </p>
                <p className={`document-manager__status document-manager__status--${doc.status}`}>
                  {doc.status === 'processing' ? 'Processing' : doc.status === 'processed' ? 'Processed' : 'Failed'}
                </p>
                {doc.notes && <p className="document-manager__notes">{doc.notes}</p>}
              </div>
              <div className="document-manager__actions">
                <button type="button" onClick={() => void onDownload(doc)} disabled={doc.status !== 'processed'}>
                  Download
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
