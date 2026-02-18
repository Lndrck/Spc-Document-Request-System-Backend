const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development','production','test').default('development'),
  PORT: Joi.number().default(5000),
  
  // New: DATABASE_URL is now allowed
  DATABASE_URL: Joi.string().description('Full MySQL connection string'),

  // Modified: These are now only REQUIRED if DATABASE_URL is missing
  DB_HOST: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  DB_USER: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  DB_NAME: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  
  DB_PORT: Joi.number().default(3306),
  DB_PASS: Joi.string().allow('', null),
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
  console.error('Environment validation error:', error.details.map(d => d.message).join(', '));
  process.exit(1);
}

module.exports = value;