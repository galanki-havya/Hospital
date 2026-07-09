import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { restrictTo } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { SYSTEM_ROLES } from '../config/roles.js';
import {
  registerTenantSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  updateProfileSchema,
  inviteStaffSchema,
} from '../validations/authValidation.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

router.post('/register', authLimiter, validate({ body: registerTenantSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', validate({ body: refreshSchema }), authController.refresh);

router.use(authenticate);

router.post('/logout', validate({ body: refreshSchema }), authController.logout);
router.get('/me', authController.me);
router.patch('/me', validate({ body: updateProfileSchema }), authController.updateProfile);
router.post('/change-password', validate({ body: changePasswordSchema }), authController.changePassword);

router.post(
  '/staff/invite',
  restrictTo(SYSTEM_ROLES.HOSPITAL_ADMIN),
  validate({ body: inviteStaffSchema }),
  authController.inviteStaff
);

export default router;
