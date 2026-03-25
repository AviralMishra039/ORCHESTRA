function stripJsonFences(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text.trim();
  // Remove markdown valid json block
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.substring(firstNewline + 1);
    }
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3).trim();
  }
  return cleaned.trim();
}

async function parseAgentOutput(text, openaiClient) {
  let cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.log('JSON parse failed, asking GPT-4o for correction...');
    const correctionPrompt = `Your previous response was not valid JSON. Return ONLY the JSON object, no other text: \n\n${text}`;
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: correctionPrompt }],
      temperature: 0.1
    });
    cleaned = stripJsonFences(response.choices[0].message.content);
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      throw new Error(`Failed to parse agent JSON output: ${err2.message}. Raw output: ${text}`);
    }
  }
}

module.exports = {
  stripJsonFences,
  parseAgentOutput
};
