const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development','production','test').default('development'),
  PORT: Joi.number().default(5000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().allow('', null),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().min(32).required(),
  SMTP_HOST: Joi.string().allow('', null),
  SMTP_PORT: Joi.number().allow(null),
  SMTP_USER: Joi.string().allow('', null),
  SMTP_PASS: Joi.string().allow('', null),
  SMTP_FROM: Joi.string().allow('', null),
  FRONTEND_URL: Joi.string().uri().required()
}).unknown(true);

const { value, error } = schema.validate(process.env, { allowUnknown: true, abortEarly: false });
if (error) {
  // eslint-disable-next-line no-console
  console.error('Environment validation error:', error.details.map(d => d.message).join(', '));
  process.exit(1);
}

module.exports = value;
