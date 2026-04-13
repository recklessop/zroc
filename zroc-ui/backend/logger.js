// backend/logger.js
'use strict';
const { createLogger, format, transports } = require('winston');
const config = require('./config');

const logger = createLogger({
  level: config.is_dev ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    config.is_dev
      ? format.combine(format.colorize(), format.simple())
      : format.json()
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
