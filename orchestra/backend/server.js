require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const { submitSchema } = require('./models/schemas');
const { orchestrate } = require('./pipeline/orchestrator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const db = require('./db/database');

app.post('/api/submit', upload.single('pptx_file'), async (req, res) => {
  try {
    const data = req.body;
    
    // Validate
    const parsed = submitSchema.safeParse(data);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.format() });
    }

    const { team_name, github_url, prototype_url } = parsed.data;
    const hasPptx = !!req.file;
    const hasGithub = !!(github_url && github_url.trim() !== '');

    if (!hasPptx && !hasGithub) {
      return res.status(400).json({ success: false, error: "At least one of Pitch Deck (.pptx) or GitHub URL must be provided." });
    }

    // Run pipeline
    const pipelineResult = await orchestrate(req.file ? { pptx_file: req.file } : null, req.body);
    const { judgeOutputs, audit, chief, feedback, rawContent } = pipelineResult;

    const submission_id = crypto.randomUUID();

    // Insert to DB
    const stmt = db.prepare(`
      INSERT INTO submissions (id, team_name, raw_content, prototype_url, total_score, confidence_tier, dimension_scores, agent_outputs, feedback_report, bias_flags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      submission_id,
      team_name,
      rawContent,
      prototype_url || null,
      chief.total_score,
      chief.confidence_tier,
      JSON.stringify(chief.dimension_scores),
      JSON.stringify(judgeOutputs),
      feedback,
      JSON.stringify(audit.flags || []),
      new Date().toISOString()
    );

    res.json({ 
      success: true, 
      data: { 
        submission_id, 
        team_name, 
        total_score: chief.total_score, 
        confidence_tier: chief.confidence_tier, 
        dimension_scores: chief.dimension_scores, 
        feedback, 
        agent_outputs: judgeOutputs 
      } 
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = db.prepare('SELECT id as submission_id, team_name, total_score, confidence_tier, dimension_scores, prototype_url FROM submissions ORDER BY total_score DESC').all();
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

app.get('/api/results/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Submission not found" });
    
    // Process overrides
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

    // Update total scores based on latest overrides
    const latestOverrides = db.prepare('SELECT dimension, new_score FROM overrides WHERE submission_id = ? ORDER BY created_at DESC').all(sub_id);
    const overrideMap = {};
    latestOverrides.forEach(o => {
      if (!(o.dimension in overrideMap)) {
        overrideMap[o.dimension] = o.new_score;
      }
    });

    // recalculate total score
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

app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
    const avg = db.prepare('SELECT AVG(total_score) as avg FROM submissions').get().avg || 0;
    const topTeam = db.prepare('SELECT team_name, total_score FROM submissions ORDER BY total_score DESC LIMIT 1').get() || null;
    
    const rows = db.prepare('SELECT total_score FROM submissions').all();
    const score_distribution = { '0-20':0, '21-40':0, '41-60':0, '61-80':0, '81-100':0 };
    rows.forEach(r => {
      const s = r.total_score;
      if (s <= 20) score_distribution['0-20']++;
      else if (s <= 40) score_distribution['21-40']++;
      else if (s <= 60) score_distribution['41-60']++;
      else if (s <= 80) score_distribution['61-80']++;
      else score_distribution['81-100']++;
    });

    res.json({ success: true, data: { total_submissions: total, average_score: avg, top_team: topTeam, score_distribution }});
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Orchestra Backend running on port ${PORT}`);
});
