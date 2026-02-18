const { createLogger, transports, format } = require('winston');
const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({ format: isProd ? format.simple() : format.combine(format.colorize(), format.simple()) })
  ]
});

module.exports = logger;
