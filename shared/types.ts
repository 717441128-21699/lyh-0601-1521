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
  originalData?: ChangeFieldSnapshot;
  newData?: ChangeFieldSnapshot;
}

export interface ChangeFieldSnapshot {
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionName: string;
  managerId: string | null;
  managerName: string | null;
  costCenter: string;
  attendanceGroup: string;
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

export interface BatchRecord {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  config: BatchExecutionConfig;
  changes: EmployeeChange[];
  currentIndex: number;
  operator: string;
  createdAt: string;
  completedAt?: string;
  resultId?: string;
}

export interface ExecutionResult {
  batchId: string;
  batchName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  rolledBackCount: number;
  successItems: EmployeeChange[];
  failedItems: EmployeeChange[];
  rolledBackItems: EmployeeChange[];
  allItems: EmployeeChange[];
  startTime: string;
  endTime: string;
  operator: string;
  retryAttempts?: number;
}

export interface RollbackRecord {
  batchId: string;
  batchName: string;
  operator: string;
  operationTime: string;
  executedAt?: string;
  changeCount: number;
  rolledBackCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  beforeSnapshot: EmployeeChange[];
  afterSnapshot: EmployeeChange[];
  rollbackReference: string;
  status: 'available' | 'rollback_in_progress' | 'rolled_back' | 'rollback_failed';
}

export interface PrecheckColumnMapping {
  sourceColumn: string;
  targetField: string;
  detected: boolean;
  required: boolean;
  sampleValue: string;
  formatHint?: string;
}

export interface PrecheckRow {
  rowIndex: number;
  values: Record<string, string>;
  issues: { field: string; type: 'missing' | 'format'; message: string }[];
}

export interface PrecheckResponse {
  columns: string[];
  rows: PrecheckRow[];
  totalRows: number;
  mapping: PrecheckColumnMapping[];
  detectedDelimiter: string;
  formatSuggestions: {
    dateFields: string[];
    dateFormats: { detected: string; sample: string; normalized: string }[];
  };
  issuesCount: {
    missing: number;
    format: number;
    total: number;
  };
}

export interface ApplyMappingRequest {
  mapping: Array<{ sourceColumn: string; targetField: string }>;
  dateOverrides?: { field: string; format: string }[];
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
  resumeBatchId?: string;
}

export interface ExecuteResponse {
  batchId: string;
  config: BatchExecutionConfig;
}

export interface BatchStatusResponse {
  batch: BatchRecord | null;
  result?: ExecutionResult;
  progress: {
    current: number;
    total: number;
    percentage: number;
    successCount: number;
    failedCount: number;
  };
}

export interface ReportRequest {
  batchId: string;
}

export interface ReportResponse {
  result: ExecutionResult;
  rollbackInfo?: RollbackRecord;
  batchInfo?: BatchRecord;
}

export interface MasterDataResponse {
  departments: Department[];
  positions: Position[];
  employees: Employee[];
}

export const TARGET_FIELDS: Record<string, { label: string; required: boolean }> = {
  employeeId: { label: '员工编号', required: true },
  employeeName: { label: '员工姓名', required: false },
  sourceDepartment: { label: '原部门', required: true },
  targetDepartment: { label: '新部门', required: true },
  targetPosition: { label: '新岗位', required: true },
  effectiveDate: { label: '生效日期', required: true },
  newManagerId: { label: '新主管编号/姓名', required: true },
};

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
  rolled_back: '已撤回',
};

export const STATUS_COLORS: Record<EmployeeChange['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  validated: 'bg-blue-100 text-blue-600',
  submitting: 'bg-amber-100 text-amber-600',
  success: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  rolled_back: 'bg-slate-200 text-slate-600',
};
