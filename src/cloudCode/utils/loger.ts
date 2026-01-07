import winston = require('winston');
import DailyRotateFile = require('winston-daily-rotate-file');

export const LoggerAdapter: winston.Logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new DailyRotateFile({
      filename: 'logs-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH-mm',
      dirname: './logs',
      zippedArchive: true,
      utc: true,
      maxSize: '5000m',
      frequency: '2m',
    }),
  ],
});
