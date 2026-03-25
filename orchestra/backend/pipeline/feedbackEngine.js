function feedbackEngine(judgeOutputs, chief, audit) {
  let report = "# Final Feedback Report\n\n";
  report += `**Overall Score:** ${chief.total_score} / 100\n`;
  report += `**Confidence Tier:** ${chief.confidence_tier}\n\n`;
  report += `> ${chief.ranking_notes}\n\n`;

  if (audit.bias_detected) {
    report += `**Auditor Notes:** ${audit.auditor_notes}\n\n`;
  }

  judgeOutputs.forEach(judge => {
    report += `## ${judge.dimension.charAt(0).toUpperCase() + judge.dimension.slice(1)} Judge\n`;
    report += `**Score:** ${judge.score} / ${judge.max_score}\n\n`;
    report += `**Strengths:**\n`;
    judge.strengths.forEach(s => report += `- ${s}\n`);
    report += `\n**Improvements:**\n`;
    judge.improvements.forEach(i => report += `- ${i}\n`);
    report += `\n`;
  });

  return report;
}

module.exports = { feedbackEngine };
