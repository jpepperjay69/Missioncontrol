-- Mission Control schema (PostgreSQL). Applied in order by server/db.js.
-- All queries in the app are parameterized; no dynamic SQL is built from user input.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS donors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gifts (
  id SERIAL PRIMARY KEY,
  donor_id INTEGER NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  gift_date DATE NOT NULL,
  method TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gifts_donor_idx ON gifts(donor_id);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE,
  location TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_notes (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_notes_event_idx ON event_notes(event_id);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  due_date DATE,
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders(due_date) WHERE completed = false;

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS letter_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS letters (
  id SERIAL PRIMARY KEY,
  donor_id INTEGER REFERENCES donors(id) ON DELETE SET NULL,
  gift_id INTEGER REFERENCES gifts(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES letter_templates(id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  actor_name TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS thrift_staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  hire_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thrift_meeting_notes (
  id SERIAL PRIMARY KEY,
  meeting_date DATE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thrift_payroll (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES thrift_staff(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  hours NUMERIC(8,2),
  rate NUMERIC(10,2),
  amount NUMERIC(12,2),
  paid BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thrift_truck_expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE,
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt scans are stored as bytea in Postgres. At this app's scale
-- (a small nonprofit's receipts) that is the simplest setup that survives
-- Render deploys, where the local filesystem is ephemeral. If receipt volume
-- grows, move the file bytes to an S3-compatible bucket and store the object
-- key here instead (see README "Receipt storage").
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  vendor TEXT,
  amount NUMERIC(12,2),
  receipt_date DATE,
  note TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signin_sheets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  sheet_date DATE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signin_entries (
  id SERIAL PRIMARY KEY,
  sheet_id INTEGER NOT NULL REFERENCES signin_sheets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  time_in TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signin_entries_sheet_idx ON signin_entries(sheet_id);

-- Built-in thank-you letter templates (app functionality, not sample data).
-- Placeholders: {{donor_name}} {{amount}} {{gift_date}} {{org_name}}
INSERT INTO letter_templates (name, subject, body) VALUES
  ('Standard thank-you', 'Thank you for your gift',
   'Dear {{donor_name}},\n\nThank you so much for your generous gift of ${{amount}} on {{gift_date}}. Your support makes a real difference in the lives of the people {{org_name}} serves.\n\nWith gratitude,\n{{org_name}}'),
  ('First-time donor', 'Welcome, and thank you!',
   'Dear {{donor_name}},\n\nWelcome to the {{org_name}} family, and thank you for your first gift of ${{amount}} on {{gift_date}}. We are so glad you chose to stand with us, and we look forward to keeping you close to the work your generosity makes possible.\n\nWith gratitude,\n{{org_name}}'),
  ('Year-end thank-you', 'Thank you for giving this year',
   'Dear {{donor_name}},\n\nAs the year closes, we want to thank you for your gift of ${{amount}} on {{gift_date}} and for all you have done for {{org_name}} this year. Because of you, we can keep showing up for our neighbors.\n\nWith gratitude,\n{{org_name}}')
ON CONFLICT DO NOTHING;
