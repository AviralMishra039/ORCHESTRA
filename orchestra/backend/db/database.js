const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL not set in .env! NeonDB connection will fail.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost/db',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hackathons (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT,
        description TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(255) PRIMARY KEY,
        hackathon_id VARCHAR(255) REFERENCES hackathons(id),
        team_name TEXT,
        raw_content TEXT,
        prototype_url TEXT,
        total_score REAL,
        confidence_tier TEXT,
        dimension_scores TEXT,
        agent_outputs TEXT,
        feedback_report TEXT,
        bias_flags TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS overrides (
        id VARCHAR(255) PRIMARY KEY,
        submission_id VARCHAR(255) REFERENCES submissions(id),
        dimension TEXT,
        original_score REAL,
        new_score REAL,
        reason TEXT,
        judge_name TEXT,
        created_at TEXT
      );
    `);
    console.log("Neon Postgres Database schema initialized.");
  } catch(e) {
    console.error("Failed to initialize Neon Postgres:", e.message);
  }
}

// Automatically create tables on startup
initDB();

module.exports = pool;
