import { createCrudService } from './crudServiceFactory.js';

export const departmentService = createCrudService('department', {
  searchFields: ['name'],
  moduleName: 'departments',
  entityLabel: 'Department',
});

export default departmentService;
