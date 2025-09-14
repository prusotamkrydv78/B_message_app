import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { GroupsController } from '../controllers/groups.controller.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', GroupsController.create);
router.get('/', GroupsController.listMine);
router.get('/:id', GroupsController.details);
router.patch('/:id', GroupsController.update);
router.post('/:id/members', GroupsController.addMembers);
router.delete('/:id/members/:userId', GroupsController.removeMember);
router.delete('/:id', GroupsController.delete);

export default router;
