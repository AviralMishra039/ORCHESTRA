const { parseAgentOutput } = require('../utils');
const OpenAI = require('openai');

async function presentationJudge(content) {
  const openai = new OpenAI();
  const prompt = `You are the Presentation Judge on the Orchestra hacking panel. Your expertise is evaluating communication quality, slide structure, storytelling, and overall pitch delivery. You score out of 15.

Scoring Rubric:
- 0-5: Poor unstructured slides, unclear message
- 6-10: Standard pitch structure, gets the point across but lacks storytelling
- 11-13: Very cohesive story, great flow, strong visual language cues
- 14-15: Masterful storytelling, compelling narrative, highly persuasive

If the content string contains insufficient information to evaluate this dimension, return valid JSON with score 0 and include in improvements: 'No presentation-relevant assets were provided for evaluation.'

Return ONLY valid JSON. No markdown, no code fences, no explanation, no preamble. Follow this schema exactly:
{
  "dimension": "presentation",
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
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  return await parseAgentOutput(response.choices[0].message.content, openai);
}

module.exports = presentationJudge;
