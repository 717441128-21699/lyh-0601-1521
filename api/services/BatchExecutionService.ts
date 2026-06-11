import type { EmployeeChange, BatchExecutionConfig, ExecutionResult, RollbackRecord } from '../../shared/types';
import { getEmployeeById } from '../data/masterData';

const BATCH_STORAGE_KEY = 'hr_change_batches';
const SNAPSHOT_STORAGE_KEY = 'hr_change_snapshots';

interface BatchRecord {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  config: BatchExecutionConfig;
  changes: EmployeeChange[];
  currentIndex: number;
  operator: string;
  createdAt: string;
  completedAt?: string;
}

const batchStore = new Map<string, BatchRecord>();
const resultStore = new Map<string, ExecutionResult>();
const rollbackStore = new Map<string, RollbackRecord>();

const saveToFile = () => {
  try {
    const data = {
      batches: Object.fromEntries(batchStore),
      results: Object.fromEntries(resultStore),
      rollbacks: Object.fromEntries(rollbackStore),
    };
    (globalThis as any)[BATCH_STORAGE_KEY] = JSON.stringify(data);
  } catch (e) {
    console.error('Failed to persist batch data:', e);
  }
};

const loadFromFile = () => {
  try {
    const raw = (globalThis as any)[BATCH_STORAGE_KEY];
    if (raw) {
      const data = JSON.parse(raw);
      Object.entries(data.batches || {}).forEach(([k, v]) => batchStore.set(k, v as any));
      Object.entries(data.results || {}).forEach(([k, v]) => resultStore.set(k, v as any));
      Object.entries(data.rollbacks || {}).forEach(([k, v]) => rollbackStore.set(k, v as any));
    }
  } catch (e) {
    console.error('Failed to load batch data:', e);
  }
};

loadFromFile();

const randomFailEmployeeIds = ['E007', 'E018', 'E019'];

export class BatchExecutionService {
  public createBatch(
    changes: EmployeeChange[],
    config: BatchExecutionConfig,
    batchName: string,
    operator: string = 'HR专员'
  ): string {
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const batchRecord: BatchRecord = {
      id: batchId,
      name: batchName || `异动批次-${new Date().toLocaleDateString('zh-CN')}`,
      status: 'pending',
      config,
      changes: changes.map(c => ({ ...c, status: 'submitting' as const })),
      currentIndex: 0,
      operator,
      createdAt: new Date().toISOString(),
    };
    batchStore.set(batchId, batchRecord);
    saveToFile();
    return batchId;
  }

  private createBeforeSnapshot(changes: EmployeeChange[]): EmployeeChange[] {
    return changes.map(change => {
      const employee = getEmployeeById(change.employeeId);
      return {
        ...change,
        status: 'pending',
        sourceDepartment: employee?.departmentId || change.sourceDepartment,
        targetPosition: employee?.positionId || change.targetPosition,
        newManagerId: employee?.managerId || change.newManagerId,
      };
    });
  }

  private createAfterSnapshot(changes: EmployeeChange[]): EmployeeChange[] {
    return changes.map(change => ({
      ...change,
      status: 'success',
    }));
  }

  private calculateRiskLevel(successCount: number, failedCount: number): 'low' | 'medium' | 'high' {
    const total = successCount + failedCount;
    if (total === 0) return 'low';
    const failRate = failedCount / total;
    if (failRate > 0.3) return 'high';
    if (failRate > 0.1) return 'medium';
    return 'low';
  }

  public async executeBatch(
    batchId: string,
    onProgress?: (batch: BatchRecord, processedCount: number) => void
  ): Promise<ExecutionResult> {
    const batch = batchStore.get(batchId);
    if (!batch) {
      throw new Error(`批次不存在：${batchId}`);
    }

    batch.status = 'running';
    const startTime = new Date().toISOString();
    const successItems: EmployeeChange[] = [];
    const failedItems: EmployeeChange[] = [];
    const { batchSize, intervalMs, retryCount } = batch.config;

    const beforeSnapshot = this.createBeforeSnapshot(batch.changes);

    for (let i = 0; i < batch.changes.length; i += batchSize) {
      const batchItems = batch.changes.slice(i, i + batchSize);

      for (const change of batchItems) {
        let success = false;
        let lastError = '';

        for (let attempt = 0; attempt <= retryCount && !success; attempt++) {
          try {
            await this.processSingleChange(change);
            success = true;
          } catch (e: any) {
            lastError = e.message || '未知错误';
            if (attempt < retryCount) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (success) {
          const successChange = { ...change, status: 'success' as const };
          successItems.push(successChange);
          const idx = batch.changes.findIndex(c => c.id === change.id);
          if (idx !== -1) batch.changes[idx] = successChange;
        } else {
          const failedChange = { ...change, status: 'failed' as const, failReason: lastError };
          failedItems.push(failedChange);
          const idx = batch.changes.findIndex(c => c.id === change.id);
          if (idx !== -1) batch.changes[idx] = failedChange;
        }

        batch.currentIndex = i + batchItems.indexOf(change) + 1;
        onProgress?.(batch, batch.currentIndex);
        saveToFile();
      }

      if (i + batchSize < batch.changes.length && intervalMs > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    batch.status = failedItems.length > 0 ? 'failed' : 'completed';
    batch.completedAt = new Date().toISOString();

    const endTime = new Date().toISOString();
    const result: ExecutionResult = {
      batchId,
      batchName: batch.name,
      totalCount: batch.changes.length,
      successCount: successItems.length,
      failedCount: failedItems.length,
      successItems,
      failedItems,
      startTime,
      endTime,
      operator: batch.operator,
    };

    resultStore.set(batchId, result);

    const afterSnapshot = this.createAfterSnapshot(successItems);
    const rollbackRecord: RollbackRecord = {
      batchId,
      batchName: batch.name,
      operator: batch.operator,
      operationTime: endTime,
      changeCount: successItems.length,
      riskLevel: this.calculateRiskLevel(successItems.length, failedItems.length),
      beforeSnapshot,
      afterSnapshot,
      rollbackReference: `批次【${batch.name}】于 ${new Date(endTime).toLocaleString('zh-CN')} 执行完成。共处理 ${batch.changes.length} 条异动，成功 ${successItems.length} 条，失败 ${failedItems.length} 条。回滚操作将恢复成功项的原始数据，失败项保持不变。`,
      status: 'available',
    };
    rollbackStore.set(batchId, rollbackRecord);

    saveToFile();
    return result;
  }

  private async processSingleChange(change: EmployeeChange): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

    if (!change.employeeId) {
      throw new Error('员工编号为空');
    }

    if (randomFailEmployeeIds.includes(change.employeeId)) {
      const reasons = [
        '员工考勤系统数据同步失败，请稍后重试',
        '权限校验失败：该员工的审批流程已锁定',
        '接口调用超时：HRIS系统响应超时',
        '数据冲突：该员工存在未完成的异动审批单',
      ];
      throw new Error(reasons[Math.floor(Math.random() * reasons.length)]);
    }

    const rand = Math.random();
    if (rand < 0.05) {
      throw new Error('系统处理异常：事务提交失败，请重试');
    }
  }

  public getBatch(batchId: string): BatchRecord | undefined {
    return batchStore.get(batchId);
  }

  public getResult(batchId: string): ExecutionResult | undefined {
    return resultStore.get(batchId);
  }

  public getRollbackRecord(batchId: string): RollbackRecord | undefined {
    return rollbackStore.get(batchId);
  }

  public getAllRollbackRecords(): RollbackRecord[] {
    return Array.from(rollbackStore.values()).sort(
      (a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime()
    );
  }

  public getAllResults(): ExecutionResult[] {
    return Array.from(resultStore.values()).sort(
      (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    );
  }

  public async retryFailedItems(
    batchId: string,
    changeIds?: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<ExecutionResult> {
    const existingResult = resultStore.get(batchId);
    const batch = batchStore.get(batchId);
    if (!existingResult || !batch) {
      throw new Error(`批次不存在：${batchId}`);
    }

    const itemsToRetry = existingResult.failedItems.filter(
      item => !changeIds || changeIds.includes(item.id)
    );

    if (itemsToRetry.length === 0) {
      return existingResult;
    }

    const retryStartTime = new Date().toISOString();
    const newSuccess: EmployeeChange[] = [];
    const stillFailed: EmployeeChange[] = [];

    for (let i = 0; i < itemsToRetry.length; i++) {
      const change = itemsToRetry[i];
      try {
        await this.processSingleChange(change);
        const successChange = { ...change, status: 'success' as const, failReason: undefined };
        newSuccess.push(successChange);
      } catch (e: any) {
        stillFailed.push({ ...change, failReason: e.message });
      }
      onProgress?.(i + 1, itemsToRetry.length);
      saveToFile();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const updatedSuccess = [...existingResult.successItems, ...newSuccess];
    const updatedFailed = [
      ...existingResult.failedItems.filter(f => !itemsToRetry.some(r => r.id === f.id)),
      ...stillFailed,
    ];

    const newResult: ExecutionResult = {
      ...existingResult,
      successCount: updatedSuccess.length,
      failedCount: updatedFailed.length,
      successItems: updatedSuccess,
      failedItems: updatedFailed,
      endTime: new Date().toISOString(),
    };

    resultStore.set(batchId, newResult);

    batch.changes = batch.changes.map(c => {
      const success = updatedSuccess.find(s => s.id === c.id);
      if (success) return success;
      const failed = updatedFailed.find(f => f.id === c.id);
      if (failed) return failed;
      return c;
    });

    const rollback = rollbackStore.get(batchId);
    if (rollback) {
      rollback.afterSnapshot = this.createAfterSnapshot(updatedSuccess);
      rollback.changeCount = updatedSuccess.length;
      rollback.riskLevel = this.calculateRiskLevel(updatedSuccess.length, updatedFailed.length);
      rollback.rollbackReference = `批次【${batch.name}】于 ${new Date().toLocaleString('zh-CN')} 重试完成。累计成功 ${updatedSuccess.length} 条，失败 ${updatedFailed.length} 条。`;
    }

    saveToFile();
    return newResult;
  }

  public async executeRollback(batchId: string): Promise<{ success: boolean; message: string; rolledBackCount: number }> {
    const rollback = rollbackStore.get(batchId);
    const result = resultStore.get(batchId);
    if (!rollback || !result) {
      return { success: false, message: '批次不存在或已过期', rolledBackCount: 0 };
    }

    if (rollback.status === 'rolled_back') {
      return { success: false, message: '该批次已执行过回滚操作', rolledBackCount: 0 };
    }

    rollback.status = 'rollback_in_progress';
    saveToFile();

    await new Promise(resolve => setTimeout(resolve, 1000));

    const rollbackCount = rollback.afterSnapshot.length;

    result.successItems = result.successItems.map(item => ({
      ...item,
      status: 'rolled_back',
    }));

    rollback.status = 'rolled_back';
    rollback.rollbackReference += ` 【已于 ${new Date().toLocaleString('zh-CN')} 完成回滚，恢复 ${rollbackCount} 条记录】`;

    saveToFile();

    return {
      success: true,
      message: `回滚成功，共恢复 ${rollbackCount} 条员工异动数据`,
      rolledBackCount: rollbackCount,
    };
  }
}

export const batchExecutionService = new BatchExecutionService();
