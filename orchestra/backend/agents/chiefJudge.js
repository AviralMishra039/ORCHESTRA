const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function chiefJudge(judgeOutputs, auditResult) {
  const openai = new OpenAI();

  const prompt = `You are the Chief Judge on the Orchestra hacking panel.
You receive the 5 judge outputs and bias auditor report. Your job is to summarize and calculate the final confidence tier.
The total score is the exact sum of all 5 scores (out of 100).
If any judge returned a fallback score (e.g. 0 because of missing info), confidence tier MUST be "Low".
Otherwise assign "High" or "Medium" based on the auditor's findings and strength of evidence.

Judges Outputs:
${JSON.stringify(judgeOutputs, null, 2)}

Auditor Result:
${JSON.stringify(auditResult, null, 2)}

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "total_score": <number>,
  "max_score": 100,
  "confidence_tier": "High|Medium|Low",
  "dimension_scores": {
    "innovation": <number>,
    "technical": <number>,
    "business": <number>,
    "presentation": <number>,
    "clarity": <number>
  },
  "ranking_notes": "Brief explanation of standout factors"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });

  return await parseAgentOutput(response.choices[0].message.content, openai);
}

module.exports = chiefJudge;
