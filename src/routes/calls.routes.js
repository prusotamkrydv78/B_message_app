import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CallsController } from '../controllers/calls.controller.js';

const router = Router();

router.post('/', requireAuth, CallsController.createCall);
router.post('/test', requireAuth, CallsController.createTestCall);
router.get('/with/:userId', requireAuth, CallsController.callHistoryWith);

export default router;
