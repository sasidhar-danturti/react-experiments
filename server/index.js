import express from 'express';
import cors from 'cors';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuid } from 'uuid';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

async function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(STORE_PATH)) {
    const initialPayload = { sessions: [] };
    await writeFile(STORE_PATH, JSON.stringify(initialPayload, null, 2), 'utf-8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await readFile(STORE_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function createDefaultReport(title) {
  const timestamp = new Date().toISOString();
  return {
    title: `${title} — Intelligence Brief`,
    executiveSummary: 'Use the chat panel to brief the Databricks agent on your objectives. Summaries and insights will accumulate here.',
    sections: [],
    recommendations: [],
    nextSteps: ['Collaborate with stakeholders to validate the initial findings.', 'Prioritise the highest impact initiatives.', 'Schedule a follow-up review using the saved session.'],
    lastUpdated: timestamp,
    revisionHistory: []
  };
}

function synthesiseInsights(prompt) {
  return [
    `Focused analysis on: ${prompt}`,
    'Databricks proxy mapped potential data sources and partner teams.',
    'Consider validating these insights with domain SMEs before publishing.'
  ];
}

function buildSectionFromPrompt(prompt) {
  return {
    heading: `Insights for ${prompt.slice(0, 48)}${prompt.length > 48 ? '…' : ''}`,
    bullets: [
      `Context: ${prompt}.`,
      'Opportunities: Leverage Databricks Lakehouse intelligence to surface cross-domain correlations.',
      'Risks: Ensure governance and quality checks before automation.'
    ]
  };
}

function updateReport(report, prompt) {
  const timestamp = new Date().toISOString();
  const section = buildSectionFromPrompt(prompt);
  const executiveSummary = `${report.executiveSummary}\n\nLatest highlight (${new Date(timestamp).toLocaleString()}): ${prompt}.`;
  const recommendations = Array.from(
    new Set([
      ...report.recommendations,
      `Deep dive into ${prompt} with Databricks SQL and dashboards.`,
      'Align with executive sponsors on measurable success metrics.'
    ])
  );
  const nextSteps = Array.from(
    new Set([
      ...report.nextSteps,
      `Schedule a working session to operationalise insights regarding ${prompt}.`
    ])
  );

  return {
    ...report,
    executiveSummary,
    sections: [...report.sections, section],
    recommendations,
    nextSteps,
    lastUpdated: timestamp,
    revisionHistory: [
      {
        timestamp,
        question: prompt,
        highlights: `Agent expanded report with focus on ${prompt}.`
      },
      ...report.revisionHistory
    ]
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/sessions', async (_req, res) => {
  const store = await readStore();
  const summaries = store.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessagePreview: session.messages.at(-1)?.content ?? ''
  }));
  res.json(summaries);
});

app.post('/api/sessions', async (req, res) => {
  const { title } = req.body;
  const now = new Date().toISOString();
  const store = await readStore();
  const session = {
    id: uuid(),
    title: title?.trim() || 'New Strategy Report',
    createdAt: now,
    updatedAt: now,
    messages: [],
    report: createDefaultReport(title?.trim() || 'New Strategy Report')
  };
  store.sessions.push(session);
  await writeStore(store);
  res.status(201).json(session);
});

app.get('/api/sessions/:id', async (req, res) => {
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === req.params.id);
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }
  res.json(session);
});

app.patch('/api/sessions/:id', async (req, res) => {
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === req.params.id);
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }
  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    session.title = req.body.title.trim();
    session.updatedAt = new Date().toISOString();
    await writeStore(store);
  }
  res.json({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessagePreview: session.messages.at(-1)?.content ?? ''
  });
});

app.delete('/api/sessions/:id', async (req, res) => {
  const store = await readStore();
  const index = store.sessions.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).send('Session not found');
    return;
  }
  store.sessions.splice(index, 1);
  await writeStore(store);
  res.status(204).end();
});

app.post('/api/sessions/:id/invoke', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).send('Prompt is required');
    return;
  }
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === req.params.id);
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }

  const now = new Date().toISOString();
  const userMessage = {
    id: uuid(),
    role: 'user',
    content: prompt,
    createdAt: now
  };

  session.messages.push(userMessage);

  const report = updateReport(session.report, prompt);
  session.report = report;

  const agentMessage = {
    id: uuid(),
    role: 'agent',
    content: `The Databricks proxy agent analysed your prompt and infused the report with a dedicated section covering ${prompt}. It also refreshed the recommendations and revision log.`,
    createdAt: new Date().toISOString()
  };

  session.messages.push(agentMessage);
  session.updatedAt = new Date().toISOString();

  await writeStore(store);

  res.json({
    message: agentMessage,
    report,
    insights: synthesiseInsights(prompt)
  });
});

app.put('/api/sessions/:id/report', async (req, res) => {
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === req.params.id);
  if (!session) {
    res.status(404).send('Session not found');
    return;
  }
  const report = req.body;
  session.report = { ...session.report, ...report, lastUpdated: new Date().toISOString() };
  session.updatedAt = new Date().toISOString();
  await writeStore(store);
  res.json(session.report);
});

app.listen(PORT, () => {
  console.log(`Databricks agent proxy listening on http://localhost:${PORT}`);
});
