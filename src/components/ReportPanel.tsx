import { useMemo } from 'react';
import type { ReportArtifact } from '../types';
import './ReportPanel.css';

interface ReportPanelProps {
  report: ReportArtifact | null;
  disabled?: boolean;
  onDownloadMarkdown?: (report: ReportArtifact) => void;
  onDownloadPdf?: (report: ReportArtifact) => void;
}

export function ReportPanel({ report, disabled, onDownloadMarkdown, onDownloadPdf }: ReportPanelProps) {
  const preparedSections = useMemo(() => report?.sections ?? [], [report]);

  if (!report) {
    return (
      <section className="report-panel report-panel--empty">
        <h2>Report workspace</h2>
        <p>The agent will curate an executive summary, key findings, and recommended next steps.</p>
      </section>
    );
  }

  return (
    <section className="report-panel">
      <header className="report-panel__header">
        <div>
          <h2>{report.title}</h2>
          <p className="report-panel__timestamp">Last updated {new Date(report.lastUpdated).toLocaleString()}</p>
        </div>
        <div className="report-panel__actions">
          <button
            type="button"
            onClick={() => report && onDownloadMarkdown?.(report)}
            disabled={disabled}
            className="report-panel__download"
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => report && onDownloadPdf && onDownloadPdf(report)}
            disabled={disabled}
            className="report-panel__download"
          >
            PDF
          </button>
        </div>
      </header>

      <article className="report-panel__body">
        <section>
          <h3>Executive Summary</h3>
          <p>{report.executiveSummary}</p>
        </section>

        {preparedSections.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            <ul>
              {section.bullets.map((bullet, index) => (
                <li key={`${section.heading}-${index}`}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h3>Recommendations</h3>
          <ul>
            {report.recommendations.map((recommendation, index) => (
              <li key={`rec-${index}`}>{recommendation}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Next Steps</h3>
          <ol>
            {report.nextSteps.map((step, index) => (
              <li key={`step-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      </article>

      <footer className="report-panel__footer">
        <h4>Revision history</h4>
        <ul>
          {report.revisionHistory.map((revision, index) => (
            <li key={`revision-${index}`}>
              <strong>{new Date(revision.timestamp).toLocaleString()}:</strong> {revision.highlights}
              <span className="report-panel__revision-question">Prompt: {revision.question}</span>
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
