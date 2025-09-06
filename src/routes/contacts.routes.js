import { Router } from 'express';
import { ContactsController } from '../controllers/contacts.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, ContactsController.create);

export default router;
