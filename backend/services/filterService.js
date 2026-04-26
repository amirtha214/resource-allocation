const pool = require('../db/pool');

/**
 * Filter volunteers by:
 *  1. skills[]          – array of skill IDs they must possess
 *  2. minProficiency    – minimum proficiency level for each matched skill
 *  3. availableDays[]   – days they must be available
 *
 * Returns full volunteer rows with aggregated skills and availability.
 */

const PROFICIENCY_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

async function filterVolunteers({ skills = [], minProficiency, availableDays = [] }) {
  const conditions = [];
  const params     = [];
  let   p          = 1;

  let sql = `
    SELECT
      v.id,
      v.name,
      v.email,
      v.phone,
      v.bio,
      v.avatar_url,
      v.created_at,
      json_agg(DISTINCT jsonb_build_object(
        'skill_id',    vs.skill_id,
        'skill_name',  s.name,
        'category',    s.category,
        'proficiency', vs.proficiency,
        'years_exp',   vs.years_exp
      )) FILTER (WHERE vs.skill_id IS NOT NULL) AS skills,
      json_agg(DISTINCT jsonb_build_object(
        'day',        va.day_of_week,
        'start_time', va.start_time,
        'end_time',   va.end_time
      )) FILTER (WHERE va.id IS NOT NULL) AS availability
    FROM volunteers v
    LEFT JOIN volunteer_skills       vs ON vs.volunteer_id = v.id
    LEFT JOIN skills                 s  ON s.id = vs.skill_id
    LEFT JOIN volunteer_availability va ON va.volunteer_id = v.id
  `;

  // Build WHERE sub-queries
  const where = [];

  // Criteria 1 + 2: must have all requested skills at/above minProficiency
  if (skills.length > 0) {
    const profIdx = minProficiency
      ? PROFICIENCY_ORDER.indexOf(minProficiency)
      : 0;
    const validProfs = PROFICIENCY_ORDER.slice(profIdx < 0 ? 0 : profIdx);
    const profPlaceholders = validProfs.map((_, i) => `$${p + i}`).join(', ');
    const skillPlaceholders = skills.map((_, i) => `$${p + validProfs.length + i}`).join(', ');

    where.push(`
      (SELECT COUNT(DISTINCT vs2.skill_id)
       FROM volunteer_skills vs2
       WHERE vs2.volunteer_id = v.id
         AND vs2.skill_id IN (${skillPlaceholders})
         AND vs2.proficiency IN (${profPlaceholders})
      ) = ${skills.length}
    `);

    validProfs.forEach(pr => params.push(pr));
    skills.forEach(sid => params.push(sid));
    p += validProfs.length + skills.length;
  }

  // Criteria 3: must be available on ALL requested days
  if (availableDays.length > 0) {
    const dayPlaceholders = availableDays.map((_, i) => `$${p + i}`).join(', ');
    where.push(`
      (SELECT COUNT(DISTINCT va2.day_of_week)
       FROM volunteer_availability va2
       WHERE va2.volunteer_id = v.id
         AND va2.day_of_week IN (${dayPlaceholders})
      ) = ${availableDays.length}
    `);
    availableDays.forEach(d => params.push(d));
    p += availableDays.length;
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' GROUP BY v.id ORDER BY v.name';

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = { filterVolunteers };