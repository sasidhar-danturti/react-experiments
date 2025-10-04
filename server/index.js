import express from 'express';
import cors from 'cors';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { v4 as uuid } from 'uuid';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const upload = multer({ dest: UPLOAD_DIR });

async function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(STORE_PATH)) {
    const initialPayload = { users: [] };
    await writeFile(STORE_PATH, JSON.stringify(initialPayload, null, 2), 'utf-8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await readFile(STORE_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function saveStore(store) {
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function createDefaultReport(title) {
  const timestamp = new Date().toISOString();
  return {
    title: `${title} — Intelligence Brief`,
    executiveSummary: 'Collaborate with the Databricks reporting agent to iteratively craft this deliverable. Upload supporting evidence, ask clarifying questions, and let the workspace synthesise the findings.',
    sections: [],
    recommendations: [],
    nextSteps: [
      'Review uploaded documents for data quality and completeness.',
      'Align the insights with stakeholder objectives.',
      'Schedule a read-out once the report reaches publication quality.'
    ],
    lastUpdated: timestamp,
    revisionHistory: []
  };
}

function synthesiseInsights(prompt, context = []) {
  return [
    `Focused analysis on: ${prompt}.`,
    'Databricks proxy orchestrated Lakehouse assets and ML-driven reasoning to propose the next best actions.',
    context.length
      ? `Referenced ${context.length} uploaded artefact${context.length === 1 ? '' : 's'} during synthesis.`
      : 'Upload relevant evidence to sharpen future iterations.'
  ];
}

function buildSectionFromPrompt(prompt, documents = []) {
  return {
    heading: `Insights for ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`,
    bullets: [
      `Context: ${prompt}.`,
      documents.length
        ? `Supporting evidence: ${documents.map((doc) => doc.originalName).join(', ')}.`
        : 'Supporting evidence: none supplied yet.',
      'Opportunities: Leverage Databricks Lakehouse intelligence to surface cross-domain correlations.',
      'Risks: Ensure governance, lineage, and model monitoring before automation.'
    ]
  };
}

function updateReport(report, prompt, documents = []) {
  const timestamp = new Date().toISOString();
  const section = buildSectionFromPrompt(prompt, documents);
  const executiveSummary = `${report.executiveSummary}\n\nLatest highlight (${new Date(timestamp).toLocaleString()}): ${prompt}.`;
  const recommendations = Array.from(
    new Set([
      ...report.recommendations,
      `Deep dive into ${prompt} using Databricks SQL, dashboards, and collaborative notebooks.`,
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

function findUser(store, userId) {
  return store.users.find((item) => item.id === userId);
}

async function resolveUser(req, res) {
  const userId = req.header('x-user-id') || req.query.userId;
  if (!userId) {
    res.status(401).json({ message: 'x-user-id header is required' });
    return undefined;
  }
  const store = await readStore();
  const user = findUser(store, userId);
  if (!user) {
    res.status(401).json({ message: 'User not found' });
    return undefined;
  }
  return { store, user };
}

function normaliseTask(task) {
  return {
    id: task.id,
    title: task.title,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastMessagePreview: task.messages.at(-1)?.content ?? ''
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const store = await readStore();
  let user = store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  const now = new Date().toISOString();

  if (!user) {
    user = {
      id: uuid(),
      email,
      password,
      name: name?.trim() || email.split('@')[0],
      createdAt: now,
      updatedAt: now,
      tasks: [],
      documents: []
    };
    store.users.push(user);
    await saveStore(store);
  } else if (user.password !== password) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  res.json({
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }
  });
});

app.get('/api/tasks', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { user } = result;
  res.json(user.tasks.map(normaliseTask));
});

app.post('/api/tasks', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { store, user } = result;
  const { title } = req.body ?? {};
  const now = new Date().toISOString();
  const task = {
    id: uuid(),
    title: title?.trim() || 'New Intelligence Task',
    createdAt: now,
    updatedAt: now,
    messages: [],
    report: createDefaultReport(title?.trim() || 'New Intelligence Task')
  };
  user.tasks.push(task);
  user.updatedAt = now;
  await saveStore(store);
  res.status(201).json(task);
});

app.get('/api/tasks/:id', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { user } = result;
  const task = user.tasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  res.json(task);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { store, user } = result;
  const task = user.tasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    task.title = req.body.title.trim();
    task.updatedAt = new Date().toISOString();
    user.updatedAt = task.updatedAt;
    await saveStore(store);
  }
  res.json(normaliseTask(task));
});

app.delete('/api/tasks/:id', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { store, user } = result;
  const index = user.tasks.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  user.tasks.splice(index, 1);
  user.updatedAt = new Date().toISOString();
  await saveStore(store);
  res.status(204).end();
});

app.post('/api/tasks/:id/invoke', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { store, user } = result;
  const task = user.tasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ message: 'Prompt is required' });
    return;
  }

  const now = new Date().toISOString();
  const userMessage = {
    id: uuid(),
    role: 'user',
    content: prompt,
    createdAt: now
  };

  task.messages.push(userMessage);

  const documents = user.documents.filter((doc) => doc.status === 'processed');
  const report = updateReport(task.report, prompt, documents);
  task.report = report;

  const agentMessage = {
    id: uuid(),
    role: 'agent',
    content: `The Databricks proxy analysed your question "${prompt}" using the orchestrated ingestion pipeline and refreshed the report with a new section.`,
    createdAt: new Date().toISOString()
  };

  task.messages.push(agentMessage);
  task.updatedAt = agentMessage.createdAt;
  user.updatedAt = agentMessage.createdAt;

  await saveStore(store);

  res.json({
    message: agentMessage,
    report,
    insights: synthesiseInsights(prompt, documents)
  });
});

app.put('/api/tasks/:id/report', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { store, user } = result;
  const task = user.tasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  task.report = {
    ...task.report,
    ...req.body,
    lastUpdated: new Date().toISOString()
  };
  task.updatedAt = task.report.lastUpdated;
  user.updatedAt = task.updatedAt;
  await saveStore(store);
  res.json(task.report);
});

app.get('/api/tasks/:id/report/pdf', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { user } = result;
  const task = user.tasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${task.title.replace(/[^a-z0-9\-]+/gi, '_')}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text(task.report.title, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Last updated: ${new Date(task.report.lastUpdated).toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).text('Executive Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(task.report.executiveSummary);
  doc.moveDown();

  if (task.report.sections?.length) {
    doc.fontSize(14).text('Sections', { underline: true });
    doc.moveDown(0.5);
    task.report.sections.forEach((section) => {
      doc.fontSize(13).text(section.heading, { continued: false, underline: true });
      doc.moveDown(0.2);
      section.bullets?.forEach((bullet) => {
        doc.fontSize(12).text(`• ${bullet}`);
      });
      doc.moveDown();
    });
  }

  if (task.report.recommendations?.length) {
    doc.fontSize(14).text('Recommendations', { underline: true });
    doc.moveDown(0.5);
    task.report.recommendations.forEach((item) => doc.fontSize(12).text(`• ${item}`));
    doc.moveDown();
  }

  if (task.report.nextSteps?.length) {
    doc.fontSize(14).text('Next Steps', { underline: true });
    doc.moveDown(0.5);
    task.report.nextSteps.forEach((item) => doc.fontSize(12).text(`• ${item}`));
    doc.moveDown();
  }

  if (task.report.revisionHistory?.length) {
    doc.fontSize(14).text('Revision History', { underline: true });
    doc.moveDown(0.5);
    task.report.revisionHistory.forEach((entry) => {
      doc.fontSize(12).text(`${new Date(entry.timestamp).toLocaleString()} — ${entry.highlights}`);
    });
  }

  doc.end();
});

app.get('/api/documents', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { user } = result;
  res.json(user.documents ?? []);
});

app.post('/api/documents', upload.single('file'), async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) {
    if (req.file) {
      await unlink(req.file.path).catch(() => undefined);
    }
    return;
  }
  const { store, user } = result;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const now = new Date().toISOString();
  const documentRecord = {
    id: uuid(),
    originalName: req.file.originalname,
    storedName: req.file.filename,
    uploadedAt: now,
    size: req.file.size,
    status: 'processing',
    notes: 'Queued for simulated Databricks ingestion agent.'
  };

  user.documents.push(documentRecord);
  user.updatedAt = now;
  await saveStore(store);

  setTimeout(async () => {
    const refreshedStore = await readStore();
    const refreshedUser = findUser(refreshedStore, user.id);
    const doc = refreshedUser?.documents.find((item) => item.id === documentRecord.id);
    if (doc) {
      doc.status = 'processed';
      doc.notes = 'Processed by simulated ingestion agent. Available for downstream reasoning.';
      await saveStore(refreshedStore);
    }
  }, 2000).unref();

  res.status(201).json(documentRecord);
});

app.get('/api/documents/:id/download', async (req, res) => {
  const result = await resolveUser(req, res);
  if (!result) return;
  const { user } = result;
  const documentRecord = user.documents.find((doc) => doc.id === req.params.id);
  if (!documentRecord) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, documentRecord.storedName);
  if (!existsSync(filePath)) {
    res.status(410).json({ message: 'Stored file missing' });
    return;
  }
  res.setHeader('Content-Disposition', `attachment; filename="${documentRecord.originalName}"`);
  createReadStream(filePath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`Databricks agent proxy listening on http://localhost:${PORT}`);
});
