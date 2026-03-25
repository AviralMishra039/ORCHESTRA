const { parserPipeline } = require('./parser');
const innovationJudge = require('../agents/innovationJudge');
const technicalJudge = require('../agents/technicalJudge');
const businessJudge = require('../agents/businessJudge');
const presentationJudge = require('../agents/presentationJudge');
const clarityJudge = require('../agents/clarityJudge');
const biasAuditor = require('../agents/biasAuditor');
const chiefJudge = require('../agents/chiefJudge');
const { feedbackEngine } = require('./feedbackEngine');

async function orchestrate(files, inputs) {
  const content = await parserPipeline(files, inputs);

  const judgeResults = await Promise.allSettled([
    innovationJudge(content),
    technicalJudge(content),
    businessJudge(content),
    presentationJudge(content),
    clarityJudge(content)
  ]);

  const defaultDims = ["innovation", "technical", "business", "presentation", "clarity"];
  const maxScores = [25, 25, 15, 15, 20];
  
  const judgeOutputs = judgeResults.map((r, i) => {
    return r.status === 'fulfilled'
      ? r.value
      : { 
          dimension: defaultDims[i], 
          score: 0, 
          max_score: maxScores[i],
          evidence: [], 
          strengths: [], 
          improvements: [`Agent ${i} failed: ${r.reason}`], 
          confidence: "low" 
        }
  });

  const audit = await biasAuditor(judgeOutputs);
  const chief = await chiefJudge(judgeOutputs, audit);
  const feedback = feedbackEngine(judgeOutputs, chief, audit);

  return { judgeOutputs, audit, chief, feedback, rawContent: content };
}

module.exports = { orchestrate };
