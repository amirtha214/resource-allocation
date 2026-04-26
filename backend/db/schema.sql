-- Smart Resource Allocation Schema
-- PostgreSQL 14+

-- ENUMs
CREATE TYPE proficiency_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE project_status    AS ENUM ('planning', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE assignment_status AS ENUM ('pending', 'confirmed', 'declined', 'completed');
CREATE TYPE availability_day  AS ENUM ('mon','tue','wed','thu','fri','sat','sun');
CREATE TYPE skill_category    AS ENUM (
  'engineering','design','marketing','operations','finance',
  'legal','hr','product','data','other'
);

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE volunteers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  phone         VARCHAR(30),
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skills (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) UNIQUE NOT NULL,
  category      skill_category NOT NULL DEFAULT 'other'
);

CREATE TABLE volunteer_skills (
  volunteer_id  INT REFERENCES volunteers(id) ON DELETE CASCADE,
  skill_id      INT REFERENCES skills(id) ON DELETE CASCADE,
  proficiency   proficiency_level NOT NULL DEFAULT 'intermediate',
  years_exp     NUMERIC(4,1),
  PRIMARY KEY (volunteer_id, skill_id)
);

CREATE TABLE volunteer_availability (
  id            SERIAL PRIMARY KEY,
  volunteer_id  INT REFERENCES volunteers(id) ON DELETE CASCADE,
  day_of_week   availability_day NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  UNIQUE (volunteer_id, day_of_week, start_time)
);

CREATE TABLE projects (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  status           project_status NOT NULL DEFAULT 'planning',
  start_date       DATE,
  end_date         DATE,
  required_hours   NUMERIC(6,1),
  priority         INT CHECK (priority BETWEEN 1 AND 5) DEFAULT 3,
  manager_name     VARCHAR(120),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_skill_requirements (
  project_id    INT REFERENCES projects(id) ON DELETE CASCADE,
  skill_id      INT REFERENCES skills(id) ON DELETE CASCADE,
  min_proficiency proficiency_level NOT NULL DEFAULT 'intermediate',
  required_count  INT NOT NULL DEFAULT 1,
  PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE assignments (
  id             SERIAL PRIMARY KEY,
  volunteer_id   INT REFERENCES volunteers(id) ON DELETE CASCADE,
  project_id     INT REFERENCES projects(id) ON DELETE CASCADE,
  status         assignment_status NOT NULL DEFAULT 'pending',
  allocated_hours NUMERIC(6,1),
  match_score    NUMERIC(5,2),           -- 0–100 computed score
  notes          TEXT,
  assigned_at    TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at   TIMESTAMPTZ,
  UNIQUE (volunteer_id, project_id)
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  VARCHAR(60),
  record_id   INT,
  action      VARCHAR(10),
  changed_by  VARCHAR(120),
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  payload     JSONB
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_vs_volunteer  ON volunteer_skills(volunteer_id);
CREATE INDEX idx_vs_skill      ON volunteer_skills(skill_id);
CREATE INDEX idx_va_volunteer  ON volunteer_availability(volunteer_id);
CREATE INDEX idx_asgn_project  ON assignments(project_id);
CREATE INDEX idx_asgn_status   ON assignments(status);
CREATE INDEX idx_proj_status   ON projects(status);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_volunteers_updated
  BEFORE UPDATE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION log_assignment_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log(table_name, record_id, action, payload)
  VALUES ('assignments', NEW.id, TG_OP, row_to_json(NEW));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignments_audit
  AFTER INSERT OR UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION log_assignment_changes();

-- ─── Seed Data ───────────────────────────────────────────────────────────────
INSERT INTO skills (name, category) VALUES
  ('JavaScript',    'engineering'),
  ('Python',        'engineering'),
  ('React',         'engineering'),
  ('PostgreSQL',    'engineering'),
  ('UI/UX Design',  'design'),
  ('Figma',         'design'),
  ('Data Analysis', 'data'),
  ('Project Mgmt',  'operations'),
  ('Marketing',     'marketing'),
  ('Copywriting',   'marketing');

INSERT INTO volunteers (name, email, phone) VALUES
  ('Arjun Menon',     'arjun@example.com',   '+91-9876543210'),
  ('Priya Nair',      'priya@example.com',   '+91-9876543211'),
  ('Kavya Krishnan',  'kavya@example.com',   '+91-9876543212'),
  ('Rohan Sharma',    'rohan@example.com',   '+91-9876543213'),
  ('Ananya Iyer',     'ananya@example.com',  '+91-9876543214');

INSERT INTO volunteer_skills (volunteer_id, skill_id, proficiency, years_exp) VALUES
  (1,1,'expert',5), (1,3,'advanced',4), (1,4,'intermediate',2),
  (2,5,'expert',6), (2,6,'expert',5), (2,7,'intermediate',2),
  (3,2,'advanced',3), (3,7,'advanced',4), (3,8,'intermediate',1),
  (4,1,'intermediate',2), (4,9,'advanced',3), (4,10,'expert',4),
  (5,8,'expert',7), (5,3,'beginner',1);

INSERT INTO volunteer_availability (volunteer_id, day_of_week, start_time, end_time) VALUES
  (1,'mon','09:00','17:00'), (1,'wed','09:00','17:00'), (1,'fri','09:00','13:00'),
  (2,'tue','10:00','18:00'), (2,'thu','10:00','18:00'), (2,'sat','09:00','15:00'),
  (3,'mon','14:00','20:00'), (3,'tue','14:00','20:00'), (3,'wed','14:00','20:00'),
  (4,'wed','09:00','17:00'), (4,'fri','09:00','17:00'),
  (5,'mon','08:00','16:00'), (5,'tue','08:00','16:00'), (5,'thu','08:00','16:00');

INSERT INTO projects (name, description, status, start_date, end_date, required_hours, priority, manager_name) VALUES
  ('Community App Rebuild',  'Rebuild volunteer portal with modern stack', 'active',    '2025-06-01','2025-09-30', 400, 5, 'Meera Pillai'),
  ('Brand Refresh 2025',     'Update visual identity across all channels',  'planning',  '2025-07-01','2025-08-31', 120, 3, 'Suresh Kumar'),
  ('Data Dashboard',         'Analytics dashboard for operations team',     'active',    '2025-05-15','2025-07-31', 200, 4, 'Divya Ramesh'),
  ('Outreach Campaign',      'Social media and content marketing push',     'planning',  '2025-06-15','2025-08-15', 160, 3, 'Nisha Patel');

INSERT INTO project_skill_requirements (project_id, skill_id, min_proficiency, required_count) VALUES
  (1,1,'advanced',2), (1,3,'advanced',2), (1,4,'intermediate',1),
  (2,5,'expert',1),   (2,6,'advanced',1), (2,10,'intermediate',1),
  (3,7,'advanced',2), (3,2,'intermediate',1), (3,4,'intermediate',1),
  (4,9,'advanced',1), (4,10,'expert',1),  (4,8,'intermediate',1);