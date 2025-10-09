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

3. **(Optional) Start the Python LangGraph web service**

   A FastAPI-based service that mimics the Databricks LangGraph agent is
   available under `python_service/agent_service.py`.

   **Local quickstart (uses the built-in in-memory SQLite warehouse):**

   ```bash
   # 1) Install Python dependencies (FastAPI, Uvicorn, SQLAlchemy, LangChain, LangGraph, etc.)
   pip install -r python_service/requirements.txt  # adjust the list as needed

   # 2) Provide an LLM implementation inside make_llm()
   #    (e.g., return ChatOpenAI(model="gpt-4o-mini", temperature=0.1))

   # 3) Launch the API (no SQL_WAREHOUSE_URL required)
   uvicorn python_service.agent_service:app --reload --port 8001
   ```

   The default configuration keeps data in an in-memory SQLite database so the
   service boots without any additional infrastructure. When you are ready to
   target a real warehouse, set ``SQL_WAREHOUSE_URL`` to any SQLAlchemy
   connection string (Databricks, Snowflake, PostgreSQL, etc.) and optionally
   ``SQL_DEFAULT_CATALOG`` / ``SQL_DEFAULT_SCHEMA`` to control default
   namespacing.

   **Hosting for testing:**

   - Add your LLM credentials as environment variables and update
     `make_llm()` accordingly.
   - Start the service with a production-ready server, for example:

     ```bash
     uvicorn python_service.agent_service:app --host 0.0.0.0 --port 8001 --workers 2
     ```

   - Deploy the container to your preferred platform (Render, Railway,
     Fly.io, Azure Container Apps, etc.). Mount any configuration as
     environment variables and, if you need persistence, point
     ``SQL_WAREHOUSE_URL`` to a managed database instance instead of the
     default in-memory SQLite store.

   The service exposes `/chat` for agent interactions and `/health` for health
   checks. Because it relies on generic SQLAlchemy connections it works with
   any SQL warehouse that exposes the required metadata tables.

4. **Production build**

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

