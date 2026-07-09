import { createCrudController } from '../controllers/crudControllerFactory.js';
import { createCrudRouter } from './crudRouterFactory.js';
import { departmentService } from '../services/departmentService.js';
import { createDepartmentSchema, updateDepartmentSchema } from '../validations/doctorValidation.js';
import { MODULES } from '../config/roles.js';

const controller = createCrudController(departmentService);

const router = createCrudRouter(controller, {
  moduleName: MODULES.DEPARTMENTS,
  createSchema: createDepartmentSchema,
  updateSchema: updateDepartmentSchema,
});

export default router;
