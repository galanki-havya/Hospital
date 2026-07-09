import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as platformAuthController from '../controllers/platformAuthController.js';
import { authenticatePlatform } from '../middleware/authenticatePlatform.js';
import { validate } from '../middleware/validate.js';
import {
  platformLoginSchema,
  platformRefreshSchema,
  platformChangePasswordSchema,
} from '../validations/platformValidation.js';

const router = Router();

// Tighter limiter than tenant login — this surface has no self-serve signup,
// so any brute-force traffic here is inherently suspicious.
const platformAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

router.post(
  '/login',
  platformAuthLimiter,
  validate({ body: platformLoginSchema }),
  platformAuthController.login
);
router.post('/refresh', validate({ body: platformRefreshSchema }), platformAuthController.refresh);

router.use(authenticatePlatform);

router.post('/logout', validate({ body: platformRefreshSchema }), platformAuthController.logout);
router.get('/me', platformAuthController.me);
router.post(
  '/change-password',
  validate({ body: platformChangePasswordSchema }),
  platformAuthController.changePassword
);

export default router;
