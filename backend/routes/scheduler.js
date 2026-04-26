const express = require('express');
const router  = express.Router();
const { buildTimeline, buildHeatmap } = require('../services/schedulerService');

// ── GET /api/scheduler/timeline ───────────────────────────────────────────
// Query: from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/timeline', async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildTimeline({ from, to });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/scheduler/heatmap ────────────────────────────────────────────
// Query: from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/heatmap', async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildHeatmap({ from, to });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;