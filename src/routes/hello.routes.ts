import { Router, type Request, type Response } from 'express';
import { createLogger } from '../services/logger.js';

const logger = createLogger('HelloRoutes');
const router = Router();

/**
 * GET /api/hello
 * Simple Hello World endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  logger.info('Hello World endpoint called');
  res.json({ message: 'Hello World' });
});

export default router;
