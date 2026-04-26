const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { filterVolunteers }       = require('../services/filterService');
const { rankVolunteersForProject } = require('../services/allocationService');

// ── GET /api/volunteers ────────────────────────────────────────────────────
// Query params: skills (CSV of IDs), minProficiency, availableDays (CSV)
router.get('/', async (req, res) => {
  try {
    const skills        = req.query.skills ? req.query.skills.split(',').map(Number) : [];
    const minProficiency = req.query.minProficiency || null;
    const availableDays  = req.query.availableDays ? req.query.availableDays.split(',') : [];

    if (skills.length || minProficiency || availableDays.length) {
      const rows = await filterVolunteers({ skills, minProficiency, availableDays });
      return res.json(rows);
    }

    // No filters – return all with aggregated data
    const { rows } = await pool.query(`
      SELECT
        v.id, v.name, v.email, v.phone, v.bio, v.avatar_url, v.created_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'skill_id',    vs.skill_id,
            'skill_name',  s.name,
            'category',    s.category,
            'proficiency', vs.proficiency,
            'years_exp',   vs.years_exp
          )) FILTER (WHERE vs.skill_id IS NOT NULL), '[]'
        ) AS skills,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'day',        va.day_of_week,
            'start_time', va.start_time,
            'end_time',   va.end_time
          )) FILTER (WHERE va.id IS NOT NULL), '[]'
        ) AS availability
      FROM volunteers v
      LEFT JOIN volunteer_skills       vs ON vs.volunteer_id = v.id
      LEFT JOIN skills                  s  ON s.id = vs.skill_id
      LEFT JOIN volunteer_availability  va ON va.volunteer_id = v.id
      GROUP BY v.id
      ORDER BY v.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/volunteers/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'skill_id', vs.skill_id, 'skill_name', s.name,
            'category', s.category, 'proficiency', vs.proficiency,
            'years_exp', vs.years_exp
          )) FILTER (WHERE vs.skill_id IS NOT NULL), '[]'
        ) AS skills,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'day', va.day_of_week, 'start_time', va.start_time, 'end_time', va.end_time
          )) FILTER (WHERE va.id IS NOT NULL), '[]'
        ) AS availability,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'project_id', a.project_id, 'project_name', p.name,
            'status', a.status, 'match_score', a.match_score,
            'allocated_hours', a.allocated_hours
          )) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) AS assignments
      FROM volunteers v
      LEFT JOIN volunteer_skills       vs ON vs.volunteer_id = v.id
      LEFT JOIN skills                  s  ON s.id = vs.skill_id
      LEFT JOIN volunteer_availability  va ON va.volunteer_id = v.id
      LEFT JOIN assignments             a  ON a.volunteer_id = v.id
      LEFT JOIN projects                p  ON p.id = a.project_id
      WHERE v.id = $1
      GROUP BY v.id
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Volunteer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/volunteers ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, phone, bio, avatar_url, skills = [], availability = [] } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [vol] } = await client.query(
      `INSERT INTO volunteers (name, email, phone, bio, avatar_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, email, phone || null, bio || null, avatar_url || null]
    );

    for (const sk of skills) {
      await client.query(
        `INSERT INTO volunteer_skills (volunteer_id, skill_id, proficiency, years_exp)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [vol.id, sk.skill_id, sk.proficiency || 'intermediate', sk.years_exp || null]
      );
    }

    for (const av of availability) {
      await client.query(
        `INSERT INTO volunteer_availability (volunteer_id, day_of_week, start_time, end_time)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [vol.id, av.day, av.start_time, av.end_time]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(vol);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/volunteers/rank?projectId=X ─────────────────────────────────
router.get('/rank', async (req, res) => {
  const projectId = parseInt(req.query.projectId);
  const limit     = parseInt(req.query.limit || '20');
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  try {
    const ranked = await rankVolunteersForProject(projectId, limit);
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;