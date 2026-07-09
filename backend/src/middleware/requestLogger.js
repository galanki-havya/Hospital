import morgan from 'morgan';
import { logger } from '../utils/logger.js';

const stream = {
  write: (message) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};

export const requestLogger = morgan(
  ':method :url :status :res[content-length]B - :response-time ms',
  { stream }
);

export default requestLogger;
