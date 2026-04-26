const pool = require('../db/pool');

/**
 * Weighted scoring algorithm – produces a 0–100 match score.
 *
 * Weights:
 *   40%  Skill match quality   (proficiency level vs requirement)
 *   25%  Skill coverage        (# required skills volunteer has)
 *   20%  Availability overlap  (days volunteer covers vs project schedule)
 *   15%  Experience depth      (average years_exp for matched skills)
 */

const PROFICIENCY_SCORE = { beginner: 25, intermediate: 50, advanced: 75, expert: 100 };
const DAYS_OF_WEEK      = ['mon','tue','wed','thu','fri','sat','sun'];

async function scoreVolunteerForProject(volunteerId, projectId) {
  const [volunteerRes, projectRes, reqRes] = await Promise.all([
    pool.query(`
      SELECT vs.skill_id, vs.proficiency, vs.years_exp,
             va.day_of_week
      FROM   volunteers v
      LEFT JOIN volunteer_skills       vs ON vs.volunteer_id = v.id
      LEFT JOIN volunteer_availability va ON va.volunteer_id = v.id
      WHERE  v.id = $1
    `, [volunteerId]),
    pool.query(`
      SELECT start_date, end_date FROM projects WHERE id = $1
    `, [projectId]),
    pool.query(`
      SELECT skill_id, min_proficiency, required_count
      FROM   project_skill_requirements
      WHERE  project_id = $1
    `, [projectId]),
  ]);

  const volunteerRows  = volunteerRes.rows;
  const project        = projectRes.rows[0];
  const requirements   = reqRes.rows;

  if (!project || requirements.length === 0) return 0;

  // Build volunteer skill map
  const skillMap = {};
  const daySet   = new Set();
  for (const row of volunteerRows) {
    if (row.skill_id) {
      skillMap[row.skill_id] = {
        proficiency: row.proficiency,
        years_exp:   parseFloat(row.years_exp) || 0,
      };
    }
    if (row.day_of_week) daySet.add(row.day_of_week);
  }

  // ── 1. Skill match quality (40%) ─────────────────────────────────────────
  let qualityTotal = 0;
  for (const req of requirements) {
    const vol  = skillMap[req.skill_id];
    const reqScore = PROFICIENCY_SCORE[req.min_proficiency] || 0;
    const volScore = vol ? PROFICIENCY_SCORE[vol.proficiency] || 0 : 0;
    // Full points if at/above requirement, partial otherwise
    qualityTotal += volScore >= reqScore ? 100 : (volScore / reqScore) * 60;
  }
  const qualityScore = requirements.length > 0 ? qualityTotal / requirements.length : 0;

  // ── 2. Skill coverage (25%) ───────────────────────────────────────────────
  const coveredCount = requirements.filter(r => !!skillMap[r.skill_id]).length;
  const coverageScore = requirements.length > 0
    ? (coveredCount / requirements.length) * 100
    : 0;

  // ── 3. Availability overlap (20%) ─────────────────────────────────────────
  // Approximate required days from project date range (Mon–Fri by default)
  let availScore = 50; // neutral if no dates
  if (project.start_date && project.end_date) {
    const start   = new Date(project.start_date);
    const end     = new Date(project.end_date);
    const daysNeeded = new Set();
    const cur = new Date(start);
    while (cur <= end && daysNeeded.size < 7) {
      const d = DAYS_OF_WEEK[cur.getDay() === 0 ? 6 : cur.getDay() - 1];
      daysNeeded.add(d);
      cur.setDate(cur.getDate() + 1);
    }
    const overlap = [...daysNeeded].filter(d => daySet.has(d)).length;
    availScore = daysNeeded.size > 0 ? (overlap / daysNeeded.size) * 100 : 50;
  }

  // ── 4. Experience depth (15%) ─────────────────────────────────────────────
  const matchedExps = requirements
    .filter(r => skillMap[r.skill_id])
    .map(r => skillMap[r.skill_id].years_exp);
  const avgExp = matchedExps.length > 0
    ? matchedExps.reduce((a, b) => a + b, 0) / matchedExps.length
    : 0;
  const expScore = Math.min(avgExp / 10, 1) * 100; // cap at 10 years = 100

  // ── Weighted total ────────────────────────────────────────────────────────
  const total = (
    qualityScore  * 0.40 +
    coverageScore * 0.25 +
    availScore    * 0.20 +
    expScore      * 0.15
  );

  return Math.round(total * 100) / 100;
}

/**
 * Rank all eligible volunteers for a project, returning top N with scores.
 */
async function rankVolunteersForProject(projectId, limit = 20) {
  const { rows: volunteers } = await pool.query(
    `SELECT id FROM volunteers`
  );

  const scored = await Promise.all(
    volunteers.map(async (v) => ({
      volunteer_id: v.id,
      score: await scoreVolunteerForProject(v.id, projectId),
    }))
  );

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  if (top.length === 0) return [];

  const ids = top.map(r => r.volunteer_id);
  const { rows: details } = await pool.query(`
    SELECT
      v.id, v.name, v.email, v.phone, v.avatar_url,
      json_agg(DISTINCT jsonb_build_object(
        'skill_id',    vs.skill_id,
        'skill_name',  s.name,
        'proficiency', vs.proficiency,
        'years_exp',   vs.years_exp
      )) FILTER (WHERE vs.skill_id IS NOT NULL) AS skills,
      json_agg(DISTINCT va.day_of_week) FILTER (WHERE va.id IS NOT NULL) AS available_days
    FROM   volunteers v
    LEFT JOIN volunteer_skills       vs ON vs.volunteer_id = v.id
    LEFT JOIN skills                 s  ON s.id = vs.skill_id
    LEFT JOIN volunteer_availability va ON va.volunteer_id = v.id
    WHERE  v.id = ANY($1)
    GROUP  BY v.id
  `, [ids]);

  const detailMap = Object.fromEntries(details.map(r => [r.id, r]));

  return top.map(r => ({
    ...detailMap[r.volunteer_id],
    match_score: r.score,
  }));
}

module.exports = { scoreVolunteerForProject, rankVolunteersForProject };