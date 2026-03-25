const { z } = require('zod');

const submitSchema = z.object({
  hackathon_name: z.string().min(1, "Hackathon name is required"),
  description: z.string().optional()
});

module.exports = { submitSchema };
