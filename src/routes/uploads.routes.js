import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UploadsController, upload } from '../controllers/uploads.controller.js';

const router = Router();

router.post('/', requireAuth, upload.array('files', 5), UploadsController.uploadFiles);

export default router;
