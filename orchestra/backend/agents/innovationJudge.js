const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function innovationJudge(content) {
  const openai = new OpenAI();
  const prompt = `You are the Innovation Judge on the Orchestra hacking panel. Your expertise is in identifying novel, creative, and highly differentiated solutions that push boundaries. You score out of 25.

Scoring Rubric:
- 0-10: Highly derivative, lacks original thought
- 11-17: Some good ideas but mostly standard approaches
- 18-22: Strong differentiation, creative mechanics or use-case
- 23-25: Exceptional novelty, completely rethinks the problem space

If the content string contains insufficient information to evaluate this dimension, return valid JSON with score 0 and include in improvements: 'No innovation-relevant assets were provided for evaluation.'

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "dimension": "innovation",
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
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  return await parseAgentOutput(response.choices[0].message.content, openai);
}

module.exports = innovationJudge;
