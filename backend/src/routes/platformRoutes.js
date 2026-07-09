import { Router } from 'express';
import * as platformController from '../controllers/platformController.js';
import { authenticatePlatform } from '../middleware/authenticatePlatform.js';
import { restrictToPlatform } from '../middleware/restrictToPlatform.js';
import { validate } from '../middleware/validate.js';
import { PLATFORM_ROLES } from '../config/roles.js';
import {
  createHospitalSchema,
  hospitalStatusSchema,
  hospitalPlanSchema,
  createSuperAdminSchema,
  superAdminStatusSchema,
  idParamSchema,
} from '../validations/platformValidation.js';

const router = Router();

router.use(authenticatePlatform);

// Both SuperAdmin and Developer can view/manage hospitals — but note the
// underlying platformService only ever exposes Tenant metadata + counts,
// never clinical data, regardless of which of these two roles is calling.
const hospitalManagers = restrictToPlatform(PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.DEVELOPER);

router.get('/stats', hospitalManagers, platformController.getStats);
router.get('/hospitals', hospitalManagers, platformController.listHospitals);
router.get('/hospitals/:id', hospitalManagers, validate({ params: idParamSchema }), platformController.getHospital);
router.post(
  '/hospitals',
  hospitalManagers,
  validate({ body: createHospitalSchema }),
  platformController.createHospital
);
router.patch(
  '/hospitals/:id/status',
  hospitalManagers,
  validate({ params: idParamSchema, body: hospitalStatusSchema }),
  platformController.setHospitalStatus
);
router.patch(
  '/hospitals/:id/plan',
  hospitalManagers,
  validate({ params: idParamSchema, body: hospitalPlanSchema }),
  platformController.setHospitalPlan
);
router.post(
  '/hospitals/:id/reset-admin-password',
  hospitalManagers,
  validate({ params: idParamSchema }),
  platformController.resetHospitalAdminPassword
);

// Developer-only: manage SuperAdmin accounts + platform-wide audit trail.
const developerOnly = restrictToPlatform(PLATFORM_ROLES.DEVELOPER);

router.get('/super-admins', developerOnly, platformController.listSuperAdmins);
router.post(
  '/super-admins',
  developerOnly,
  validate({ body: createSuperAdminSchema }),
  platformController.createSuperAdmin
);
router.patch(
  '/super-admins/:id/status',
  developerOnly,
  validate({ params: idParamSchema, body: superAdminStatusSchema }),
  platformController.setSuperAdminStatus
);
router.get('/audit-logs', developerOnly, platformController.listAuditLogs);

export default router;
