# Agentic Report Studio

This experiment showcases a React + Vite front-end that collaborates with a lightweight Node.js proxy which mimics Databricks agent calls. It allows analysts to manage multiple sessions, converse with the simulated agent, and capture evolving executive reports that are saved locally.

## Features

- Session management (create, rename, delete, resume) with persistent storage on disk.
- Real-time chat interface connected to a Databricks-style agent proxy that synthesises report updates per prompt.
- Automatic report builder with executive summary, key findings, recommendations, next steps, and revision history.
- Markdown export for completed reports.
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

- The React front-end can be deployed for free using services such as Vercel, Netlify, or GitHub Pages (build the Vite site and host the static files).
- Host the Node.js proxy on a small VM or container platform (Heroku, Render, Azure Container Apps, etc.). Configure the `VITE_API_BASE` environment variable on the front-end to point to the proxy.
- For Databricks integration, replace the simulated `/invoke` logic in `server/index.js` with calls to Databricks Model Serving or Agent APIs, securing requests with PAT tokens or service principals.
- Persist reports using production-grade storage (e.g., Databricks Delta tables, Azure Blob Storage) for enterprise retention requirements.

## Folder structure

```
react-experiments/
├── server/            # Express proxy server
├── src/               # React application source
├── index.html
└── package.json
```
