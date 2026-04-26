const pool = require('../db/pool');

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];

/**
 * Timeline: returns a Gantt-style array of projects with
 * their confirmed assignments, ordered by start_date.
 */
async function buildTimeline({ from, to } = {}) {
  const params = [];
  let dateFilter = '';
  if (from && to) {
    dateFilter = `AND (p.start_date <= $1 AND p.end_date >= $2)`;
    params.push(to, from);
  }

  const { rows: projects } = await pool.query(`
    SELECT
      p.id,
      p.name,
      p.status,
      p.start_date,
      p.end_date,
      p.required_hours,
      p.priority,
      p.manager_name,
      COALESCE(
        json_agg(
          jsonb_build_object(
            'volunteer_id',    a.volunteer_id,
            'volunteer_name',  v.name,
            'allocated_hours', a.allocated_hours,
            'match_score',     a.match_score,
            'status',          a.status
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS assignments
    FROM projects p
    LEFT JOIN assignments a ON a.project_id = p.id AND a.status IN ('confirmed','pending')
    LEFT JOIN volunteers  v ON v.id = a.volunteer_id
    WHERE p.status NOT IN ('cancelled') ${dateFilter}
    GROUP BY p.id
    ORDER BY p.start_date ASC NULLS LAST, p.priority DESC
  `, params);

  return projects;
}

/**
 * Heatmap: for each volunteer, for each day of week, returns a
 * coverage score (0–1) representing how booked they are.
 *
 * Also returns a global grid [volunteer][day] = { available, assigned_hours }
 */
async function buildHeatmap({ from, to } = {}) {
  // 1. All availability slots
  const { rows: avSlots } = await pool.query(`
    SELECT va.volunteer_id, va.day_of_week,
           EXTRACT(EPOCH FROM (va.end_time - va.start_time))/3600 AS hours
    FROM volunteer_availability va
  `);

  // 2. Confirmed assignments in range
  const params = [];
  let dateFilter = '';
  if (from && to) {
    dateFilter = `AND (p.start_date <= $1 AND p.end_date >= $2)`;
    params.push(to, from);
  }

  const { rows: assignments } = await pool.query(`
    SELECT a.volunteer_id, a.allocated_hours, p.start_date, p.end_date
    FROM   assignments a
    JOIN   projects    p ON p.id = a.project_id
    WHERE  a.status IN ('confirmed','pending') ${dateFilter}
  `, params);

  // 3. Volunteer list
  const { rows: volunteers } = await pool.query(
    `SELECT id, name, avatar_url FROM volunteers ORDER BY name`
  );

  // Build availability map: { volunteer_id: { day: hours } }
  const availMap = {};
  for (const slot of avSlots) {
    if (!availMap[slot.volunteer_id]) availMap[slot.volunteer_id] = {};
    availMap[slot.volunteer_id][slot.day_of_week] =
      (availMap[slot.volunteer_id][slot.day_of_week] || 0) + parseFloat(slot.hours);
  }

  // Approximate weekly assigned hours per volunteer (distribute evenly across days)
  const assignedMap = {};
  for (const a of assignments) {
    const vid = a.volunteer_id;
    if (!assignedMap[vid]) assignedMap[vid] = 0;
    // Spread hours across weeks in range
    const days = a.start_date && a.end_date
      ? Math.max(1, Math.ceil((new Date(a.end_date) - new Date(a.start_date)) / 86400000))
      : 30;
    const weeks    = Math.ceil(days / 7);
    const perWeek  = parseFloat(a.allocated_hours || 0) / Math.max(weeks, 1);
    assignedMap[vid] += perWeek;
  }

  // Build grid
  const grid = volunteers.map(vol => {
    const avail = availMap[vol.id] || {};
    const weeklyAssigned = assignedMap[vol.id] || 0;
    const totalAvail = Object.values(avail).reduce((a, b) => a + b, 0) || 1;

    const days = DAYS.map(day => {
      const dayHours = avail[day] || 0;
      const dayLoad  = dayHours > 0
        ? Math.min(1, (weeklyAssigned * (dayHours / totalAvail)) / dayHours)
        : 0;
      return {
        day,
        available_hours: dayHours,
        load: Math.round(dayLoad * 100) / 100,  // 0.0 – 1.0
      };
    });

    return {
      volunteer_id:   vol.id,
      volunteer_name: vol.name,
      avatar_url:     vol.avatar_url,
      days,
      total_available_hours: totalAvail,
      total_assigned_hours:  Math.round(weeklyAssigned * 10) / 10,
    };
  });

  return { grid, days: DAYS };
}

module.exports = { buildTimeline, buildHeatmap };