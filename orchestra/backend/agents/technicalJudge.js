const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function technicalJudge(content) {
  const openai = new OpenAI();
  const prompt = `You are the Technical Judge on the Orchestra hacking panel. Your expertise is in evaluating implementation depth, architecture soundness, feasibility, file structure quality, and commit activity. You score out of 25.

Scoring Rubric:
- 0-10: Poor implementation, lacks substance or unfeasible architecture
- 11-17: Functional prototype but standard or messy code structure
- 18-22: Solid architecture, clear file structure, active commits
- 23-25: Exceptional technical depth, production-ready patterns, flawless execution

If the content string contains insufficient information to evaluate this dimension, return valid JSON with score 0 and include in improvements: 'No technical-relevant assets were provided for evaluation.'

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "dimension": "technical",
  "score": <number>,
  "max_score": 25,
  "evidence": ["point 1", "point 2"],
  "strengths": ["strength 1"],
  "improvements": ["improvement 1"],
  "confidence": "high|medium|low"
}

Content to evaluate:
${content}`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  return await parseAgentOutput(response.choices[0].message.content, openai);
}

module.exports = technicalJudge;
