const Joi = require('joi');

const schema = Joi.object({
  USER_SERVICE_PORT: Joi.number().port().default(3001),
  USER_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  NATS_URL: Joi.string().uri({ scheme: ['nats', 'tls'] }).required(),
  NATS_USER: Joi.string().optional(),
  NATS_PASSWORD: Joi.string().optional(),
  NATS_CREDS_FILE: Joi.string().optional(),
  NATS_TLS_CA: Joi.string().optional()
}).unknown();

const { value, error } = schema.validate(process.env);
if (error) throw new Error(`Invalid configuration: ${error.message}`);
module.exports = value;
