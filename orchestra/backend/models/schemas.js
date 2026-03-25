const { z } = require('zod');

const submitSchema = z.object({
  team_name: z.string().min(1, "Team name is required"),
  github_url: z.string().url("Invalid GitHub URL").optional().or(z.literal('')),
  prototype_url: z.string().url("Invalid Prototype URL").optional().or(z.literal(''))
});

module.exports = { submitSchema };
