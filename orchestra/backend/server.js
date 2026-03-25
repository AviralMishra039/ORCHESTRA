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

const activeJobs = {}; 

app.post('/api/hackathon/upload', upload.single('csv_file'), async (req, res) => {
  try {
    const data = req.body;
    const parsed = submitSchema.safeParse(data);
    
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });
    if (!req.file) return res.status(400).json({ success: false, error: "CSV file is required." });

    const hackathon_id = crypto.randomUUID();
    const ts = new Date().toISOString();

    await db.query(`
      INSERT INTO hackathons (id, name, description, created_at) VALUES ($1, $2, $3, $4)
    `, [hackathon_id, parsed.data.hackathon_name, parsed.data.description || null, ts]);

    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
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
      await db.query(`
        INSERT INTO submissions (id, hackathon_id, team_name, raw_content, prototype_url, total_score, confidence_tier, dimension_scores, agent_outputs, feedback_report, bias_flags, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        submission_id, hackathon_id, team_name, rawContent, prototype_url || null, chief.total_score,
        chief.confidence_tier, JSON.stringify(chief.dimension_scores), JSON.stringify(judgeOutputs),
        feedback, JSON.stringify(audit.flags || []), new Date().toISOString()
      ]);
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

app.get('/api/hackathons', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM hackathons ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id as submission_id, team_name, total_score, confidence_tier, dimension_scores, prototype_url, hackathon_id FROM submissions ORDER BY total_score DESC');
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

app.get('/api/leaderboard/:hackathon_id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id as submission_id, team_name, total_score, confidence_tier, dimension_scores, prototype_url, hackathon_id FROM submissions WHERE hackathon_id = $1 ORDER BY total_score DESC', [req.params.hackathon_id]);
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

app.get('/api/stats', async (req, res) => {
  try {
    const sumParams = await db.query('SELECT COUNT(*) as c, AVG(total_score) as a FROM submissions');
    const bParams = await db.query('SELECT team_name, total_score FROM submissions ORDER BY total_score DESC LIMIT 1');
    const summary = sumParams.rows[0];
    const topTeam = bParams.rows[0] || null;
    
    // Postgres COUNT/AVG returns string decimals occasionally, safely parse
    const count = parseInt(summary.c || 0);
    const avg = parseFloat(summary.a || 0);

    res.json({ success: true, data: { 
      total_submissions: count, 
      average_score: Math.round(avg * 10) / 10 || 0, 
      top_team: topTeam 
    }});
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/results/:id', async (req, res) => {
  try {
    const subRes = await db.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
    if (subRes.rows.length === 0) return res.status(404).json({ success: false, error: "Submission not found" });
    const row = subRes.rows[0];
    
    const overRes = await db.query('SELECT * FROM overrides WHERE submission_id = $1 ORDER BY created_at ASC', [req.params.id]);
    const overrides = overRes.rows;

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

app.put('/api/override/:id', async (req, res) => {
  try {
    const sub_id = req.params.id;
    const { dimension, new_score, reason, judge_name } = req.body;
    
    const subRes = await db.query('SELECT * FROM submissions WHERE id = $1', [sub_id]);
    if (subRes.rows.length === 0) return res.status(404).json({ success: false, error: "Submission not found" });
    const sub = subRes.rows[0];

    let dimScores = JSON.parse(sub.dimension_scores);
    const original_score = dimScores[dimension] || 0;

    await db.query(`
      INSERT INTO overrides (id, submission_id, dimension, original_score, new_score, reason, judge_name, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [crypto.randomUUID(), sub_id, dimension, original_score, new_score, reason, judge_name, new Date().toISOString()]);

    const latestRes = await db.query('SELECT dimension, new_score FROM overrides WHERE submission_id = $1 ORDER BY created_at DESC', [sub_id]);
    const latestOverrides = latestRes.rows;

    const overrideMap = {};
    latestOverrides.forEach(o => {
      if (!(o.dimension in overrideMap)) overrideMap[o.dimension] = o.new_score;
    });

    let totalScore = 0;
    Object.keys(dimScores).forEach(dim => {
      totalScore += overrideMap[dim] !== undefined ? overrideMap[dim] : dimScores[dim];
    });

    await db.query('UPDATE submissions SET total_score = $1 WHERE id = $2', [totalScore, sub_id]);
    res.json({ success: true, data: { message: "Override recorded", total_score: totalScore } });

  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Orchestra Backend running on port ${PORT}`));
