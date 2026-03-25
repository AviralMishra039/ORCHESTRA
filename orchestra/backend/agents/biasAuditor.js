const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function biasAuditor(judgeOutputs) {
  const openai = new OpenAI();
  const prompt = `You are the Bias Auditor on the Orchestra hacking panel. You review the outputs from the 5 specialist judges. Check for suspiciously uniform scores, implausible outliers, or patterns inconsistent with the evidence.

Judges Outputs:
${JSON.stringify(judgeOutputs, null, 2)}

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "bias_detected": false,
  "flags": [],
  "adjusted_scores": {},
  "auditor_notes": "All scores appear consistent and evidence-backed."
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });

  return await parseAgentOutput(response.choices[0].message.content, openai);
}
module.exports = biasAuditor;
