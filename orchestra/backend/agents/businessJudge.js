const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function businessJudge(content) {
  const openai = new OpenAI();
  const prompt = `You are the Business Judge on the Orchestra hacking panel. Your expertise is evaluating market clarity, revenue models, and real-world applicability. You score out of 15.

Scoring Rubric:
- 0-5: Unclear market, missing revenue model, not viable
- 6-10: Decent target audience concept, basic monetization strategy
- 11-13: Strong go-to-market plan, realistic revenue streams
- 14-15: Exceptional business case, highly scalable and monetizable

If the content string contains insufficient information to evaluate this dimension, return valid JSON with score 0 and include in improvements: 'No business-relevant assets were provided for evaluation.'

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "dimension": "business",
  "score": <number>,
  "max_score": 15,
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

module.exports = businessJudge;
