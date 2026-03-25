const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'orchestra.db');
const db = new Database(dbPath);

console.log('Initializing better-sqlite3 database at:', dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS hackathons (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    hackathon_id TEXT,
    team_name TEXT,
    raw_content TEXT,
    prototype_url TEXT,
    total_score REAL,
    confidence_tier TEXT,
    dimension_scores TEXT,
    agent_outputs TEXT,
    feedback_report TEXT,
    bias_flags TEXT,
    created_at TEXT,
    FOREIGN KEY(hackathon_id) REFERENCES hackathons(id)
  );

  CREATE TABLE IF NOT EXISTS overrides (
    id TEXT PRIMARY KEY,
    submission_id TEXT,
    dimension TEXT,
    original_score REAL,
    new_score REAL,
    reason TEXT,
    judge_name TEXT,
    created_at TEXT,
    FOREIGN KEY(submission_id) REFERENCES submissions(id)
  );
`);

// Safely attempt to add hackathon_id column if table already existed without it from the previous prototype version
try {
  db.exec('ALTER TABLE submissions ADD COLUMN hackathon_id TEXT');
} catch (e) {
  // Ignore if column already exists
}

module.exports = db;
