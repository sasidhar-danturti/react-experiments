# Agentic Report Studio

This experiment showcases a React + Vite front-end that collaborates with a lightweight Node.js proxy which mimics Databricks agent calls. It now includes authentication, document ingestion, and richer orchestration so authenticated analysts can manage iterative intelligence tasks end-to-end.

## Features

- User authentication with task-level session management (create, rename, delete, resume) stored per user.
- Evidence library that accepts uploads for a simulated Databricks ingestion agent and surfaces processing status.
- Real-time chat interface connected to a Databricks-style agent proxy that synthesises report updates per prompt and references uploaded artefacts.
- Automatic report builder with executive summary, key findings, recommendations, next steps, and revision history, plus Markdown and PDF export options.
- Health endpoint and file-based storage to keep historical conversations and reports.

## Getting started locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start both the Vite dev server and the Databricks proxy**

   ```bash
   npm run dev
   ```

   - Front-end: http://localhost:5173
   - Proxy API: http://localhost:4000/api

3. **Production build**

   ```bash
   npm run build
   npm run preview
   ```

## Deployment guidance

- The React front-end can be deployed for free using services such as Vercel, Netlify, or GitHub Pages (build the Vite site and host the static files). Protect environment variables with the hosted platform's secrets manager and configure `VITE_API_BASE` to target the hosted proxy.
- Host the Node.js proxy on a small VM or container platform (Heroku, Render, Azure Container Apps, etc.). Enable HTTPS, configure file storage for uploads, and rotate service credentials regularly.
- For Databricks integration, replace the simulated `/invoke` logic in `server/index.js` with calls to Databricks Model Serving or Agent APIs. Swap the ingestion timer for genuine ingestion workflows (e.g., Delta Live Tables or Auto Loader) and store PAT tokens/credentials securely.
- Persist reports and uploaded artefacts using production-grade storage (e.g., Databricks Delta tables, Lakehouse managed storage, or cloud object stores) for enterprise retention requirements.

## Folder structure

```
react-experiments/
├── server/            # Express proxy server
├── src/               # React application source
├── index.html
└── package.json
```

## Core flows

1. **Authenticate** — users sign in with email/password; the proxy stores user profiles alongside their tasks and documents.
2. **Create or resume a task** — launch a new intelligence task, rename it, or reopen an existing one. Each task captures the full chat history and report artifact.
3. **Upload evidence** — add source documents for the simulated Databricks ingestion agent. Processing status is surfaced in the Evidence Library and the artefacts are referenced during report synthesis.
4. **Iterate with the agent** — converse through the chat interface to refine findings. The proxy updates the report sections, recommendations, and revision log while injecting insights about uploaded content.
5. **Publish** — export deliverables as Markdown or as a generated PDF and download the curated reports for downstream sharing.

