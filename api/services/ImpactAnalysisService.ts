import type { EmployeeChange, ImpactPreview, ApproverChange, AttendanceChange, CostCenterChange } from '../../shared/types';
import { DEPARTMENTS, EMPLOYEES, getEmployeeById, getDepartmentById } from '../data/masterData';

export class ImpactAnalysisService {
  private getApprovalChain(employeeId: string, managerOverride?: Map<string, string>): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    let currentId = employeeId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const employee = getEmployeeById(currentId);
      let managerId: string | null | undefined;

      if (managerOverride && managerOverride.has(currentId)) {
        managerId = managerOverride.get(currentId);
      } else {
        managerId = employee?.managerId;
      }

      if (managerId) {
        const manager = getEmployeeById(managerId);
        if (manager) {
          chain.push(manager.name);
        }
        currentId = managerId;
      } else {
        break;
      }
    }

    return chain;
  }

  private analyzeApprovers(changes: EmployeeChange[]): ApproverChange[] {
    const managerOverride = new Map<string, string>();
    changes.forEach(c => {
      if (c.employeeId && c.newManagerId) {
        managerOverride.set(c.employeeId, c.newManagerId);
      }
    });

    return changes
      .filter(c => c.employeeId && c.newManagerId)
      .map(change => {
        const employee = getEmployeeById(change.employeeId);
        const originalApprovers = this.getApprovalChain(change.employeeId);
        const newApprovers = this.getApprovalChain(change.employeeId, managerOverride);
        const needsReview = 
          originalApprovers.length !== newApprovers.length ||
          originalApprovers.some((a, i) => a !== newApprovers[i]) ||
          !!change.targetDepartment;

        return {
          employeeId: change.employeeId,
          employeeName: employee?.name || change.employeeId,
          originalApprovers,
          newApprovers,
          needsReview,
        };
      });
  }

  private getAttendanceGroup(departmentId: string): string {
    const dept = getDepartmentById(departmentId);
    if (!dept) return 'AT-STD';

    if (['D001', 'D002', 'D003'].includes(dept.id)) return 'AT-TECH';
    if (['D007'].includes(dept.id)) return 'AT-SALES';

    let current = dept;
    while (current.parentId) {
      const parent = getDepartmentById(current.parentId);
      if (!parent) break;
      if (['D001', 'D002', 'D003'].includes(parent.id)) return 'AT-TECH';
      if (['D007'].includes(parent.id)) return 'AT-SALES';
      current = parent;
    }

    return 'AT-STD';
  }

  private analyzeAttendanceGroups(changes: EmployeeChange[]): AttendanceChange[] {
    return changes
      .filter(c => c.employeeId && c.targetDepartment)
      .map(change => {
        const employee = getEmployeeById(change.employeeId);
        const sourceDept = getDepartmentById(change.sourceDepartment);
        const targetDept = getDepartmentById(change.targetDepartment);

        const originalGroup = employee?.attendanceGroup || this.getAttendanceGroup(sourceDept?.id || '');
        const newGroup = this.getAttendanceGroup(targetDept?.id || '');
        const hasConflict = originalGroup !== newGroup;

        return {
          employeeId: change.employeeId,
          employeeName: employee?.name || change.employeeId,
          originalGroup,
          newGroup,
          hasConflict,
        };
      })
      .filter(a => a.hasConflict);
  }

  private analyzeCostCenters(changes: EmployeeChange[]): CostCenterChange[] {
    return changes
      .filter(c => c.employeeId && c.targetDepartment)
      .map(change => {
        const employee = getEmployeeById(change.employeeId);
        const sourceDept = getDepartmentById(change.sourceDepartment);
        const targetDept = getDepartmentById(change.targetDepartment);

        const originalCenter = employee?.costCenter || sourceDept?.costCenter || 'UNKNOWN';
        const newCenter = targetDept?.costCenter || 'UNKNOWN';
        const baseBudget = 150000;
        const budgetImpact = originalCenter !== newCenter ? baseBudget : 0;

        return {
          employeeId: change.employeeId,
          employeeName: employee?.name || change.employeeId,
          originalCenter,
          newCenter,
          budgetImpact,
        };
      });
  }

  public analyze(changes: EmployeeChange[]): ImpactPreview {
    const validChanges = changes.filter(c => 
      c.status === 'validated' || (!c.errors || c.errors.length === 0)
    );

    return {
      approvers: this.analyzeApprovers(validChanges),
      attendanceGroups: this.analyzeAttendanceGroups(validChanges),
      costCenters: this.analyzeCostCenters(validChanges),
    };
  }

  public getSummary(impact: ImpactPreview) {
    return {
      needsReviewCount: impact.approvers.filter(a => a.needsReview).length,
      conflictCount: impact.attendanceGroups.filter(a => a.hasConflict).length,
      totalBudgetImpact: impact.costCenters.reduce((sum, c) => sum + c.budgetImpact, 0),
    };
  }
}

export const impactAnalysisService = new ImpactAnalysisService();
