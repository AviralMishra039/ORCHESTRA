require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const csvParser = require('csv-parser');

const { submitSchema } = require('./models/schemas');
const { orchestrate } = require('./pipeline/orchestrator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });
const db = require('./db/database');

const activeJobs = {}; // In-memory dictionary tracking batch process status

app.post('/api/hackathon/upload', upload.single('csv_file'), async (req, res) => {
  try {
    const data = req.body;
    const parsed = submitSchema.safeParse(data);
    
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });
    if (!req.file) return res.status(400).json({ success: false, error: "CSV file is required." });

    const hackathon_id = crypto.randomUUID();
    const ts = new Date().toISOString();

    db.prepare(`
      INSERT INTO hackathons (id, name, description, created_at) VALUES (?, ?, ?, ?)
    `).run(hackathon_id, parsed.data.hackathon_name, parsed.data.description || null, ts);

    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        // Start background batch evaluation
        activeJobs[hackathon_id] = { total: rows.length, completed: 0, status: 'processing', errors: [] };
        processBatch(hackathon_id, rows);

        res.json({ 
          success: true, 
          data: { 
            hackathon_id, 
            message: "Batch process started", 
            total_submissions: rows.length 
          } 
        });
      });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function processBatch(hackathon_id, rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Support lenient header matching from the CSV (case-insensitive keys mapping)
    const getVal = (possibleKeys) => {
      const key = Object.keys(row).find(k => possibleKeys.includes(k.trim().toLowerCase()));
      return key ? row[key] : '';
    };

    const team_name = getVal(['team name', 'team', 'project name', 'project']);
    const github_url = getVal(['github url', 'github', 'repo url', 'repo']);
    const pptx_url = getVal(['pitch deck url', 'pitch deck', 'presentation', 'pptx url']);
    const prototype_url = getVal(['prototype url', 'prototype', 'demo link', 'demo']);

    if (!team_name || (!github_url && !pptx_url)) {
       activeJobs[hackathon_id].completed++;
       activeJobs[hackathon_id].errors.push(`Row ${i+1}: Missing essential team name, or both repo and pitch missing. Skipped.`);
       continue;
    }

    try {
      const inputs = { github_url, pptx_url, prototype_url };
      const pipelineResult = await orchestrate(null, inputs);
      const { judgeOutputs, audit, chief, feedback, rawContent } = pipelineResult;

      const submission_id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO submissions (id, hackathon_id, team_name, raw_content, prototype_url, total_score, confidence_tier, dimension_scores, agent_outputs, feedback_report, bias_flags, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        submission_id, hackathon_id, team_name, rawContent, prototype_url || null, chief.total_score,
        chief.confidence_tier, JSON.stringify(chief.dimension_scores), JSON.stringify(judgeOutputs),
        feedback, JSON.stringify(audit.flags || []), new Date().toISOString()
      );
    } catch (e) {
      console.error(`Evaluation failed for team ${team_name}:`, e);
      activeJobs[hackathon_id].errors.push(`Team ${team_name}: ${e.message}`);
    }
    
    activeJobs[hackathon_id].completed++;
  }
  
  activeJobs[hackathon_id].status = 'completed';
}


app.get('/api/hackathon/progress/:id', (req, res) => {
  const job = activeJobs[req.params.id];
  if (!job) return res.json({ success: true, data: { status: 'unknown or finished', completed: 0, total: 0 } });
  res.json({ success: true, data: job });
});

app.get('/api/hackathons', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM hackathons ORDER BY created_at DESC').all();
    res.json({ success: true, data: rows });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = db.prepare('SELECT id as submission_id, team_name, total_score, confidence_tier, dimension_scores, prototype_url, hackathon_id FROM submissions ORDER BY total_score DESC').all();
    const rankedRows = rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      dimension_scores: JSON.parse(r.dimension_scores)
    }));
    res.json({ success: true, data: rankedRows });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leaderboard/:hackathon_id', (req, res) => {
  try {
    const rows = db.prepare('SELECT id as submission_id, team_name, total_score, confidence_tier, dimension_scores, prototype_url, hackathon_id FROM submissions WHERE hackathon_id = ? ORDER BY total_score DESC').all(req.params.hackathon_id);
    const rankedRows = rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      dimension_scores: JSON.parse(r.dimension_scores)
    }));
    res.json({ success: true, data: rankedRows });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const summary = db.prepare('SELECT COUNT(*) as c, AVG(total_score) as a FROM submissions').get();
    const topTeam = db.prepare('SELECT team_name, total_score FROM submissions ORDER BY total_score DESC LIMIT 1').get() || null;
    
    res.json({ success: true, data: { 
      total_submissions: summary.c, 
      average_score: Math.round(summary.a * 10) / 10 || 0, 
      top_team: topTeam 
    }});
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Used by individual results page
app.get('/api/results/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Submission not found" });
    
    const overrides = db.prepare('SELECT * FROM overrides WHERE submission_id = ? ORDER BY created_at ASC').all(req.params.id);
    const data = {
      ...row,
      dimension_scores: JSON.parse(row.dimension_scores),
      agent_outputs: JSON.parse(row.agent_outputs),
      bias_flags: JSON.parse(row.bias_flags),
      overrides
    };
    res.json({ success: true, data });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Standard Override API
app.put('/api/override/:id', (req, res) => {
  try {
    const sub_id = req.params.id;
    const { dimension, new_score, reason, judge_name } = req.body;
    const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sub_id);
    if (!sub) return res.status(404).json({ success: false, error: "Submission not found" });

    let dimScores = JSON.parse(sub.dimension_scores);
    const original_score = dimScores[dimension] || 0;

    const insertStmt = db.prepare(`
      INSERT INTO overrides (id, submission_id, dimension, original_score, new_score, reason, judge_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(crypto.randomUUID(), sub_id, dimension, original_score, new_score, reason, judge_name, new Date().toISOString());

    const latestOverrides = db.prepare('SELECT dimension, new_score FROM overrides WHERE submission_id = ? ORDER BY created_at DESC').all(sub_id);
    const overrideMap = {};
    latestOverrides.forEach(o => {
      if (!(o.dimension in overrideMap)) overrideMap[o.dimension] = o.new_score;
    });

    let totalScore = 0;
    Object.keys(dimScores).forEach(dim => {
      totalScore += overrideMap[dim] !== undefined ? overrideMap[dim] : dimScores[dim];
    });

    db.prepare('UPDATE submissions SET total_score = ? WHERE id = ?').run(totalScore, sub_id);
    res.json({ success: true, data: { message: "Override recorded", total_score: totalScore } });

  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Orchestra Backend running on port ${PORT}`));
