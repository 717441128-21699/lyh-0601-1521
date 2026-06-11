import { create } from 'zustand';
import type {
  EmployeeChange,
  ValidationErrorType,
  ImpactPreview,
  BatchExecutionConfig,
  ExecutionResult,
  RollbackRecord,
  Department,
  Position,
  Employee,
} from '../../shared/types';

interface HRState {
  changes: EmployeeChange[];
  validChanges: EmployeeChange[];
  invalidChanges: EmployeeChange[];
  errorsByType: Record<ValidationErrorType, number>;
  totalCount: number;
  validCount: number;
  invalidCount: number;

  impact: ImpactPreview | null;
  needsReviewCount: number;
  conflictCount: number;
  totalBudgetImpact: number;

  executionId: string | null;
  executionConfig: BatchExecutionConfig;
  currentExecutionResult: ExecutionResult | null;
  allResults: ExecutionResult[];

  rollbackRecords: RollbackRecord[];
  selectedRollbackRecord: RollbackRecord | null;

  departments: Department[];
  positions: Position[];
  employees: Employee[];

  isLoading: boolean;
  error: string | null;
  currentStep: number;

  setChanges: (changes: EmployeeChange[]) => void;
  addChange: (change: EmployeeChange) => void;
  updateChange: (id: string, updates: Partial<EmployeeChange>) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;

  validateChanges: () => Promise<void>;
  analyzeImpact: () => Promise<void>;
  executeBatch: (batchName: string) => Promise<ExecutionResult | null>;
  retryFailedItems: (batchId: string, changeIds?: string[]) => Promise<ExecutionResult | null>;
  pollExecutionStatus: (batchId: string) => Promise<void>;

  fetchMasterData: () => Promise<void>;
  fetchAllReports: () => Promise<void>;
  fetchReport: (batchId: string) => Promise<void>;
  fetchRollbackRecords: () => Promise<void>;
  fetchRollbackRecord: (batchId: string) => Promise<void>;
  executeRollback: (batchId: string) => Promise<{ success: boolean; message: string }>;

  setExecutionConfig: (config: Partial<BatchExecutionConfig>) => void;
  setCurrentStep: (step: number) => void;
  setSelectedRollbackRecord: (record: RollbackRecord | null) => void;
  reset: () => void;
}

const defaultErrorsByType: Record<ValidationErrorType, number> = {
  missing: 0,
  duplicate: 0,
  invalid_department: 0,
  invalid_position: 0,
  invalid_manager: 0,
  circular_reporting: 0,
  invalid_date: 0,
};

const defaultExecutionConfig: BatchExecutionConfig = {
  batchSize: 10,
  intervalMs: 500,
  retryCount: 1,
};

export const useHRStore = create<HRState>((set, get) => ({
  changes: [],
  validChanges: [],
  invalidChanges: [],
  errorsByType: { ...defaultErrorsByType },
  totalCount: 0,
  validCount: 0,
  invalidCount: 0,

  impact: null,
  needsReviewCount: 0,
  conflictCount: 0,
  totalBudgetImpact: 0,

  executionId: null,
  executionConfig: { ...defaultExecutionConfig },
  currentExecutionResult: null,
  allResults: [],

  rollbackRecords: [],
  selectedRollbackRecord: null,

  departments: [],
  positions: [],
  employees: [],

  isLoading: false,
  error: null,
  currentStep: 0,

  setChanges: (changes) => set({ changes, totalCount: changes.length }),
  addChange: (change) => set(state => ({ changes: [...state.changes, change], totalCount: state.totalCount + 1 })),
  updateChange: (id, updates) => set(state => ({
    changes: state.changes.map(c => c.id === id ? { ...c, ...updates } : c),
  })),
  removeChange: (id) => set(state => ({
    changes: state.changes.filter(c => c.id !== id),
    totalCount: state.totalCount - 1,
  })),
  clearChanges: () => set({
    changes: [], validChanges: [], invalidChanges: [],
    totalCount: 0, validCount: 0, invalidCount: 0,
    errorsByType: { ...defaultErrorsByType },
  }),

  validateChanges: async () => {
    const { changes } = get();
    if (changes.length === 0) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/hr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '校验失败');

      const allChanges = [...data.validChanges, ...data.invalidChanges];
      set({
        changes: allChanges,
        validChanges: data.validChanges,
        invalidChanges: data.invalidChanges,
        validCount: data.summary.valid,
        invalidCount: data.summary.invalid,
        errorsByType: data.summary.errorsByType,
        isLoading: false,
        currentStep: data.summary.invalid === 0 ? 1 : 0,
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  analyzeImpact: async () => {
    const { changes } = get();
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/hr/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '分析失败');

      set({
        impact: data.impact,
        needsReviewCount: data.summary.needsReviewCount,
        conflictCount: data.summary.conflictCount,
        totalBudgetImpact: data.summary.totalBudgetImpact,
        isLoading: false,
        currentStep: 2,
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  executeBatch: async (batchName) => {
    const { validChanges, executionConfig } = get();
    const changesToSubmit = validChanges.length > 0 ? validChanges : get().changes.filter(c => !c.errors || c.errors.length === 0);

    if (changesToSubmit.length === 0) {
      set({ error: '没有可提交的有效变更' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const createRes = await fetch('/api/hr/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: changesToSubmit, config: executionConfig, batchName }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || '创建批次失败');

      const batchId = createData.executionId;
      set({ executionId: batchId });

      const execRes = await fetch(`/api/hr/execute/${batchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await execRes.json();
      if (!execRes.ok) throw new Error(result.error || '执行失败');

      set({
        currentExecutionResult: result,
        isLoading: false,
        currentStep: 3,
      });

      await get().fetchAllReports();
      await get().fetchRollbackRecords();

      return result;
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      return null;
    }
  },

  retryFailedItems: async (batchId, changeIds) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/hr/retry/${batchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '重试失败');

      set({
        currentExecutionResult: result,
        isLoading: false,
      });
      await get().fetchAllReports();
      return result;
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      return null;
    }
  },

  pollExecutionStatus: async (batchId) => {
    try {
      const res = await fetch(`/api/hr/status/${batchId}`);
      const data = await res.json();
      if (res.ok && data.result) {
        set({ currentExecutionResult: data.result });
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  },

  fetchMasterData: async () => {
    try {
      const res = await fetch('/api/hr/masterdata');
      const data = await res.json();
      if (res.ok) {
        set({
          departments: data.departments,
          positions: data.positions,
          employees: data.employees,
        });
      }
    } catch (e) {
      console.error('Fetch master data error:', e);
    }
  },

  fetchAllReports: async () => {
    try {
      const res = await fetch('/api/hr/reports');
      const data = await res.json();
      if (res.ok) {
        set({ allResults: data });
      }
    } catch (e) {
      console.error('Fetch reports error:', e);
    }
  },

  fetchReport: async (batchId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/hr/report/${batchId}`);
      const data = await res.json();
      if (res.ok) {
        set({
          currentExecutionResult: data.result,
          selectedRollbackRecord: data.rollbackInfo || null,
          isLoading: false,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  fetchRollbackRecords: async () => {
    try {
      const res = await fetch('/api/hr/rollbacks');
      const data = await res.json();
      if (res.ok) {
        set({ rollbackRecords: data });
      }
    } catch (e) {
      console.error('Fetch rollback records error:', e);
    }
  },

  fetchRollbackRecord: async (batchId) => {
    try {
      const res = await fetch(`/api/hr/rollback/${batchId}`);
      const data = await res.json();
      if (res.ok) {
        set({ selectedRollbackRecord: data });
      }
    } catch (e) {
      console.error('Fetch rollback record error:', e);
    }
  },

  executeRollback: async (batchId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/hr/rollback/${batchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '回滚失败');

      set({ isLoading: false });
      await get().fetchRollbackRecords();
      await get().fetchAllReports();
      if (get().currentExecutionResult?.batchId === batchId) {
        await get().fetchReport(batchId);
      }
      return { success: data.success, message: data.message };
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      return { success: false, message: e.message };
    }
  },

  setExecutionConfig: (config) => set(state => ({
    executionConfig: { ...state.executionConfig, ...config },
  })),

  setCurrentStep: (step) => set({ currentStep: step }),

  setSelectedRollbackRecord: (record) => set({ selectedRollbackRecord: record }),

  reset: () => set({
    changes: [], validChanges: [], invalidChanges: [],
    errorsByType: { ...defaultErrorsByType },
    totalCount: 0, validCount: 0, invalidCount: 0,
    impact: null, needsReviewCount: 0, conflictCount: 0, totalBudgetImpact: 0,
    executionId: null, currentExecutionResult: null,
    currentStep: 0, error: null,
  }),
}));
