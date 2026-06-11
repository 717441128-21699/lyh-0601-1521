export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  costCenter: string;
}

export interface Position {
  id: string;
  name: string;
  level: string;
  departmentId: string;
}

export interface Employee {
  id: string;
  name: string;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  costCenter: string;
  attendanceGroup: string;
}

export interface EmployeeChange {
  id: string;
  employeeId: string;
  employeeName?: string;
  sourceDepartment: string;
  targetDepartment: string;
  targetPosition: string;
  effectiveDate: string;
  newManagerId: string;
  newManagerName?: string;
  status: 'pending' | 'validated' | 'submitting' | 'success' | 'failed' | 'rolled_back';
  errors?: ValidationError[];
  failReason?: string;
}

export type ValidationErrorType = 
  | 'missing' 
  | 'duplicate' 
  | 'invalid_department' 
  | 'invalid_position' 
  | 'invalid_manager' 
  | 'circular_reporting' 
  | 'invalid_date';

export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ApproverChange {
  employeeId: string;
  employeeName: string;
  originalApprovers: string[];
  newApprovers: string[];
  needsReview: boolean;
}

export interface AttendanceChange {
  employeeId: string;
  employeeName: string;
  originalGroup: string;
  newGroup: string;
  hasConflict: boolean;
}

export interface CostCenterChange {
  employeeId: string;
  employeeName: string;
  originalCenter: string;
  newCenter: string;
  budgetImpact: number;
}

export interface ImpactPreview {
  approvers: ApproverChange[];
  attendanceGroups: AttendanceChange[];
  costCenters: CostCenterChange[];
}

export interface BatchExecutionConfig {
  batchSize: number;
  intervalMs: number;
  retryCount: number;
}

export interface ExecutionResult {
  batchId: string;
  batchName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  successItems: EmployeeChange[];
  failedItems: EmployeeChange[];
  startTime: string;
  endTime: string;
  operator: string;
}

export interface RollbackRecord {
  batchId: string;
  batchName: string;
  operator: string;
  operationTime: string;
  changeCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  beforeSnapshot: EmployeeChange[];
  afterSnapshot: EmployeeChange[];
  rollbackReference: string;
  status: 'available' | 'rollback_in_progress' | 'rolled_back' | 'rollback_failed';
}

export interface ValidateRequest {
  changes: EmployeeChange[];
}

export interface ValidateResponse {
  validChanges: EmployeeChange[];
  invalidChanges: EmployeeChange[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    errorsByType: Record<ValidationErrorType, number>;
  };
}

export interface PreviewRequest {
  changes: EmployeeChange[];
}

export interface PreviewResponse {
  impact: ImpactPreview;
  summary: {
    needsReviewCount: number;
    conflictCount: number;
    totalBudgetImpact: number;
  };
}

export interface ExecuteRequest {
  changes: EmployeeChange[];
  config: BatchExecutionConfig;
  batchName: string;
}

export interface ExecuteResponse {
  executionId: string;
  config: BatchExecutionConfig;
}

export interface ReportRequest {
  batchId: string;
}

export interface ReportResponse {
  result: ExecutionResult;
  rollbackInfo?: RollbackRecord;
}

export interface MasterDataResponse {
  departments: Department[];
  positions: Position[];
  employees: Employee[];
}

export const ERROR_TYPE_LABELS: Record<ValidationErrorType, string> = {
  missing: '缺失字段',
  duplicate: '重复记录',
  invalid_department: '无效部门',
  invalid_position: '无效岗位',
  invalid_manager: '无效主管',
  circular_reporting: '循环汇报',
  invalid_date: '日期无效',
};

export const STATUS_LABELS: Record<EmployeeChange['status'], string> = {
  pending: '待处理',
  validated: '已校验',
  submitting: '提交中',
  success: '成功',
  failed: '失败',
  rolled_back: '已回滚',
};

export const STATUS_COLORS: Record<EmployeeChange['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  validated: 'bg-info-100 text-info-600',
  submitting: 'bg-warning-100 text-warning-600',
  success: 'bg-success-100 text-success-600',
  failed: 'bg-danger-100 text-danger-600',
  rolled_back: 'bg-slate-200 text-slate-600',
};
