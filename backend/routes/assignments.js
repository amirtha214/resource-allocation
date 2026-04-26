const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { scoreVolunteerForProject } = require('../services/allocationService');

// ── GET /api/assignments ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id, volunteer_id, status } = req.query;
    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (project_id)  { conditions.push(`a.project_id   = $${p++}`); params.push(project_id); }
    if (volunteer_id){ conditions.push(`a.volunteer_id  = $${p++}`); params.push(volunteer_id); }
    if (status)      { conditions.push(`a.status        = $${p++}`); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT
        a.*,
        v.name  AS volunteer_name,
        v.email AS volunteer_email,
        v.avatar_url,
        p.name  AS project_name,
        p.status AS project_status,
        p.start_date,
        p.end_date
      FROM assignments a
      JOIN volunteers v ON v.id = a.volunteer_id
      JOIN projects   p ON p.id = a.project_id
      ${where}
      ORDER BY a.match_score DESC NULLS LAST, a.assigned_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/assignments/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, v.name AS volunteer_name, p.name AS project_name
      FROM assignments a
      JOIN volunteers v ON v.id = a.volunteer_id
      JOIN projects   p ON p.id = a.project_id
      WHERE a.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/assignments  ─────────────────────────────────────────────────
// Auto-computes match_score if not provided
router.post('/', async (req, res) => {
  const { volunteer_id, project_id, allocated_hours, notes, status } = req.body;
  if (!volunteer_id || !project_id)
    return res.status(400).json({ error: 'volunteer_id and project_id are required' });

  try {
    // Auto-score
    const match_score = await scoreVolunteerForProject(
      parseInt(volunteer_id),
      parseInt(project_id)
    );

    const { rows: [asgn] } = await pool.query(`
      INSERT INTO assignments
        (volunteer_id, project_id, allocated_hours, match_score, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (volunteer_id, project_id)
        DO UPDATE SET
          allocated_hours = EXCLUDED.allocated_hours,
          match_score     = EXCLUDED.match_score,
          notes           = COALESCE(EXCLUDED.notes, assignments.notes),
          status          = COALESCE(EXCLUDED.status, assignments.status)
      RETURNING *
    `, [volunteer_id, project_id, allocated_hours || null, match_score,
        notes || null, status || 'pending']);
    res.status(201).json(asgn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/assignments/:id ─────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const allowed = ['status','allocated_hours','notes'];
  const sets    = [];
  const params  = [];
  let   p       = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = $${p++}`);
      params.push(req.body[key]);
    }
  }

  // Auto-set confirmed_at
  if (req.body.status === 'confirmed') {
    sets.push(`confirmed_at = NOW()`);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE assignments SET ${sets.join(',')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/assignments/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM assignments WHERE id = $1`, [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;