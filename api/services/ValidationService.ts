import type { EmployeeChange, ValidationError, ValidationErrorType } from '../../shared/types';
import { DEPARTMENTS, POSITIONS, EMPLOYEES, getEmployeeById, getDepartmentById, getPositionById } from '../data/masterData';

export class ValidationService {
  private validateMissingFields(change: EmployeeChange): ValidationError[] {
    const errors: ValidationError[] = [];
    const requiredFields: Array<keyof EmployeeChange> = [
      'employeeId',
      'sourceDepartment',
      'targetDepartment',
      'targetPosition',
      'effectiveDate',
      'newManagerId',
    ];

    requiredFields.forEach(field => {
      const value = change[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push({
          type: 'missing',
          field,
          message: `缺少必填字段：${this.getFieldLabel(field)}`,
          suggestion: `请填写${this.getFieldLabel(field)}后重试`,
        });
      }
    });

    return errors;
  }

  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      employeeId: '员工编号',
      sourceDepartment: '原部门',
      targetDepartment: '新部门',
      targetPosition: '新岗位',
      effectiveDate: '生效日期',
      newManagerId: '新主管',
    };
    return labels[field] || field;
  }

  private validateDate(change: EmployeeChange): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!change.effectiveDate) return errors;

    const date = new Date(change.effectiveDate);
    if (isNaN(date.getTime())) {
      errors.push({
        type: 'invalid_date',
        field: 'effectiveDate',
        message: `生效日期格式无效：${change.effectiveDate}`,
        suggestion: '请使用 YYYY-MM-DD 格式填写日期',
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        errors.push({
          type: 'invalid_date',
          field: 'effectiveDate',
          message: `生效日期不能早于今天`,
          suggestion: '请选择今天或之后的日期',
        });
      }
    }

    return errors;
  }

  private validateDepartments(change: EmployeeChange): ValidationError[] {
    const errors: ValidationError[] = [];

    if (change.sourceDepartment) {
      const sourceDept = getDepartmentById(change.sourceDepartment);
      if (!sourceDept) {
        errors.push({
          type: 'invalid_department',
          field: 'sourceDepartment',
          message: `原部门不存在：${change.sourceDepartment}`,
          suggestion: `请检查部门名称或编号，现有部门包括：${DEPARTMENTS.map(d => d.name).join('、')}`,
        });
      }
    }

    if (change.targetDepartment) {
      const targetDept = getDepartmentById(change.targetDepartment);
      if (!targetDept) {
        errors.push({
          type: 'invalid_department',
          field: 'targetDepartment',
          message: `新部门不存在：${change.targetDepartment}`,
          suggestion: `请检查部门名称或编号，现有部门包括：${DEPARTMENTS.map(d => d.name).join('、')}`,
        });
      }
    }

    return errors;
  }

  private validatePosition(change: EmployeeChange): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!change.targetPosition) return errors;

    const position = getPositionById(change.targetPosition);
    if (!position) {
      errors.push({
        type: 'invalid_position',
        field: 'targetPosition',
        message: `岗位不存在：${change.targetPosition}`,
        suggestion: `请检查岗位名称或编号，现有岗位包括：${POSITIONS.map(p => p.name).join('、')}`,
      });
      return errors;
    }

    const targetDept = getDepartmentById(change.targetDepartment);
    if (targetDept && position.departmentId) {
      const posDept = getDepartmentById(position.departmentId);
      const isInHierarchy = posDept && (
        posDept.id === targetDept.id ||
        this.isDescendantDepartment(targetDept.id, posDept.id) ||
        this.isDescendantDepartment(posDept.id, targetDept.id)
      );
      if (!isInHierarchy) {
        errors.push({
          type: 'invalid_position',
          field: 'targetPosition',
          message: `岗位 ${position.name} 不属于部门 ${targetDept.name} 或其下属部门`,
          suggestion: `请确认岗位与目标部门的对应关系`,
        });
      }
    }

    return errors;
  }

  private isDescendantDepartment(ancestorId: string, descendantId: string): boolean {
    let current = getDepartmentById(descendantId);
    while (current) {
      if (current.parentId === ancestorId) return true;
      current = current.parentId ? getDepartmentById(current.parentId) : undefined;
    }
    return false;
  }

  private validateManager(change: EmployeeChange): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!change.newManagerId) return errors;

    const manager = getEmployeeById(change.newManagerId);
    if (!manager) {
      errors.push({
        type: 'invalid_manager',
        field: 'newManagerId',
        message: `新主管不存在：${change.newManagerId}`,
        suggestion: `请检查主管编号或姓名，现有员工包括：${EMPLOYEES.map(e => `${e.name}(${e.id})`).join('、')}`,
      });
    }

    if (change.employeeId && change.employeeId === change.newManagerId) {
      errors.push({
        type: 'invalid_manager',
        field: 'newManagerId',
        message: `员工不能设置自己为主管`,
        suggestion: `请选择其他员工作为主管`,
      });
    }

    return errors;
  }

  private validateDuplicates(changes: EmployeeChange[]): Map<string, ValidationError[]> {
    const errorMap = new Map<string, ValidationError[]>();
    const seen = new Map<string, string[]>();

    changes.forEach(change => {
      if (change.employeeId) {
        const existing = seen.get(change.employeeId) || [];
        existing.push(change.id);
        seen.set(change.employeeId, existing);
      }
    });

    seen.forEach((ids, employeeId) => {
      if (ids.length > 1) {
        ids.forEach(id => {
          const existing = errorMap.get(id) || [];
          existing.push({
            type: 'duplicate',
            field: 'employeeId',
            message: `员工编号 ${employeeId} 在清单中重复出现 ${ids.length} 次`,
            suggestion: `请确保每个员工在清单中只出现一次，或检查是否有遗漏区分`,
          });
          errorMap.set(id, existing);
        });
      }
    });

    return errorMap;
  }

  private validateCircularReporting(changes: EmployeeChange[]): Map<string, ValidationError[]> {
    const errorMap = new Map<string, ValidationError[]>();
    const managerMap = new Map<string, string>();

    changes.forEach(change => {
      if (change.employeeId && change.newManagerId) {
        managerMap.set(change.employeeId, change.newManagerId);
      }
    });

    EMPLOYEES.forEach(emp => {
      if (emp.managerId && !managerMap.has(emp.id)) {
        managerMap.set(emp.id, emp.managerId);
      }
    });

    changes.forEach(change => {
      if (!change.employeeId || !change.newManagerId) return;

      const visited = new Set<string>();
      let current = change.newManagerId;
      let hasCycle = false;

      while (current) {
        if (visited.has(current)) {
          hasCycle = true;
          break;
        }
        if (current === change.employeeId) {
          hasCycle = true;
          break;
        }
        visited.add(current);
        current = managerMap.get(current) || '';
      }

      if (hasCycle) {
        const existing = errorMap.get(change.id) || [];
        existing.push({
          type: 'circular_reporting',
          field: 'newManagerId',
          message: `检测到循环汇报关系：员工 ${change.employeeId} 的汇报链最终指向自己`,
          suggestion: `请检查新主管设置，确保不会形成汇报闭环`,
        });
        errorMap.set(change.id, existing);
      }
    });

    return errorMap;
  }

  public validateAll(changes: EmployeeChange[]): { validChanges: EmployeeChange[]; invalidChanges: EmployeeChange[] } {
    const validatedChanges = changes.map(change => ({ ...change, errors: [] as ValidationError[] }));

    validatedChanges.forEach(change => {
      change.errors = [
        ...this.validateMissingFields(change),
        ...this.validateDate(change),
        ...this.validateDepartments(change),
        ...this.validatePosition(change),
        ...this.validateManager(change),
      ];
    });

    const duplicateErrors = this.validateDuplicates(validatedChanges);
    duplicateErrors.forEach((errors, id) => {
      const change = validatedChanges.find(c => c.id === id);
      if (change) {
        change.errors = [...change.errors, ...errors];
      }
    });

    const circularErrors = this.validateCircularReporting(validatedChanges);
    circularErrors.forEach((errors, id) => {
      const change = validatedChanges.find(c => c.id === id);
      if (change) {
        change.errors = [...change.errors, ...errors];
      }
    });

    const enrichChange = (change: EmployeeChange): EmployeeChange => {
      const employee = getEmployeeById(change.employeeId);
      const manager = getEmployeeById(change.newManagerId);
      return {
        ...change,
        employeeName: employee?.name || change.employeeName,
        newManagerName: manager?.name || change.newManagerName,
        status: change.errors && change.errors.length > 0 ? 'pending' : 'validated',
      };
    };

    const enriched = validatedChanges.map(enrichChange);
    const validChanges = enriched.filter(c => !c.errors || c.errors.length === 0);
    const invalidChanges = enriched.filter(c => c.errors && c.errors.length > 0);

    return { validChanges, invalidChanges };
  }

  public getErrorSummary(changes: EmployeeChange[]): Record<ValidationErrorType, number> {
    const summary: Record<ValidationErrorType, number> = {
      missing: 0,
      duplicate: 0,
      invalid_department: 0,
      invalid_position: 0,
      invalid_manager: 0,
      circular_reporting: 0,
      invalid_date: 0,
    };

    changes.forEach(change => {
      change.errors?.forEach(err => {
        summary[err.type] = (summary[err.type] || 0) + 1;
      });
    });

    return summary;
  }
}

export const validationService = new ValidationService();
