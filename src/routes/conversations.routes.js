import { Router } from 'express';
import { ConversationsController } from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, ConversationsController.listRecent);
router.post('/', requireAuth, ConversationsController.start);

export default router;
