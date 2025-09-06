import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, UsersController.list);

export default router;
