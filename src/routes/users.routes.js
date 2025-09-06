import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, UsersController.list);
router.get('/validate-phone', requireAuth, UsersController.validatePhone);

export default router;
