import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { GroupMessagesController } from '../controllers/groupMessages.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/:groupId', GroupMessagesController.history);
router.post('/:groupId', GroupMessagesController.send);

export default router;
