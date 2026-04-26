const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { rankVolunteersForProject } = require('../services/allocationService');

// ── GET /api/projects ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let filter = '';
    if (status) {
      filter = 'WHERE p.status = $1';
      params.push(status);
    }

    const { rows } = await pool.query(`
      SELECT
        p.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'skill_id',       psr.skill_id,
            'skill_name',     s.name,
            'category',       s.category,
            'min_proficiency',psr.min_proficiency,
            'required_count', psr.required_count
          )) FILTER (WHERE psr.skill_id IS NOT NULL), '[]'
        ) AS required_skills,
        COUNT(DISTINCT a.id)                                     AS total_assignments,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status='confirmed') AS confirmed_assignments
      FROM projects p
      LEFT JOIN project_skill_requirements psr ON psr.project_id = p.id
      LEFT JOIN skills                      s   ON s.id = psr.skill_id
      LEFT JOIN assignments                 a   ON a.project_id = p.id
      ${filter}
      GROUP BY p.id
      ORDER BY p.priority DESC, p.start_date ASC NULLS LAST
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'skill_id', psr.skill_id, 'skill_name', s.name,
            'min_proficiency', psr.min_proficiency,
            'required_count',  psr.required_count
          )) FILTER (WHERE psr.skill_id IS NOT NULL), '[]'
        ) AS required_skills,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'assignment_id',   a.id,
            'volunteer_id',    a.volunteer_id,
            'volunteer_name',  v.name,
            'status',          a.status,
            'match_score',     a.match_score,
            'allocated_hours', a.allocated_hours
          )) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) AS assignments
      FROM projects p
      LEFT JOIN project_skill_requirements psr ON psr.project_id = p.id
      LEFT JOIN skills                      s   ON s.id = psr.skill_id
      LEFT JOIN assignments                 a   ON a.project_id = p.id
      LEFT JOIN volunteers                  v   ON v.id = a.volunteer_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    name, description, status, start_date, end_date,
    required_hours, priority, manager_name,
    required_skills = []
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [proj] } = await client.query(`
      INSERT INTO projects
        (name, description, status, start_date, end_date, required_hours, priority, manager_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [name, description, status || 'planning', start_date, end_date,
        required_hours, priority || 3, manager_name]);

    for (const sk of required_skills) {
      await client.query(`
        INSERT INTO project_skill_requirements
          (project_id, skill_id, min_proficiency, required_count)
        VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
      `, [proj.id, sk.skill_id, sk.min_proficiency || 'intermediate', sk.required_count || 1]);
    }

    await client.query('COMMIT');
    res.status(201).json(proj);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/projects/:id ───────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const allowed = ['name','description','status','start_date','end_date',
                   'required_hours','priority','manager_name'];
  const sets    = [];
  const params  = [];
  let   p       = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = $${p++}`);
      params.push(req.body[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE projects SET ${sets.join(',')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id/rank-volunteers ─────────────────────────────────
router.get('/:id/rank-volunteers', async (req, res) => {
  const limit = parseInt(req.query.limit || '20');
  try {
    const ranked = await rankVolunteersForProject(parseInt(req.params.id), limit);
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;