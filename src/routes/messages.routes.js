import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { MessagesController } from '../controllers/messages.controller.js';

const router = Router();

router.get('/with/:userId', requireAuth, MessagesController.historyWith);

export default router;
