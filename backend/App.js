require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');

const volunteersRouter  = require('./routes/volunteers');
const projectsRouter    = require('./routes/projects');
const assignmentsRouter = require('./routes/assignments');
const schedulerRouter   = require('./routes/scheduler');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/volunteers',  volunteersRouter);
app.use('/api/projects',    projectsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/scheduler',   schedulerRouter);

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  Smart Resource API listening on http://localhost:${PORT}`);
});

module.exports = app;