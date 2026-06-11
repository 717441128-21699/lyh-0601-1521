import type {
  EmployeeChange,
  BatchExecutionConfig,
  ExecutionResult,
  RollbackRecord,
  BatchRecord,
  ChangeFieldSnapshot,
} from '../../shared/types';
import { getEmployeeById, getDepartmentById, getPositionById } from '../data/masterData';
import { batchesStore, resultsStore, rollbacksStore } from './FilePersistence';

const randomFailEmployeeIds = ['E007', 'E018', 'E019'];

export class BatchExecutionService {
  private generateBatchId(): string {
    const now = new Date();
    const dateStr = now.getFullYear().toString()
      + (now.getMonth() + 1).toString().padStart(2, '0')
      + now.getDate().toString().padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `B${dateStr}-${rand}`;
  }

  private buildFieldSnapshot(
    deptId: string,
    posId: string,
    mgrId: string | null,
    costCenter: string,
    attendanceGroup: string
  ): ChangeFieldSnapshot {
    const dept = getDepartmentById(deptId);
    const pos = getPositionById(posId);
    const mgr = mgrId ? getEmployeeById(mgrId) : null;
    return {
      departmentId: dept?.id || deptId,
      departmentName: dept?.name || deptId,
      positionId: pos?.id || posId,
      positionName: pos?.name || posId,
      managerId: mgr?.id || mgrId,
      managerName: mgr?.name || mgrId,
      costCenter,
      attendanceGroup,
    };
  }

  public createBatch(
    changes: EmployeeChange[],
    config: BatchExecutionConfig,
    batchName: string,
    operator: string = 'HR专员'
  ): string {
    const existingBatch = changes[0]?.id
      ? batchesStore.values().find((b: BatchRecord) => b.changes.some((c: EmployeeChange) => c.id === changes[0].id) && b.status === 'pending')
      : null;
    if (existingBatch) return existingBatch.id;

    const batchId = this.generateBatchId();
    const timestampedChanges = changes.map((c) => ({
      ...c,
      status: 'submitting' as const,
    }));
    const batchRecord: BatchRecord = {
      id: batchId,
      name: batchName || `异动批次-${new Date().toLocaleDateString('zh-CN')}`,
      status: 'pending',
      config,
      changes: timestampedChanges,
      currentIndex: 0,
      operator,
      createdAt: new Date().toISOString(),
    };
    batchesStore.set(batchId, batchRecord);
    batchesStore.save();
    return batchId;
  }

  public getOrCreateBatch(
    resumeBatchId: string | undefined,
    changes: EmployeeChange[],
    config: BatchExecutionConfig,
    batchName: string,
    operator: string = 'HR专员'
  ): string {
    if (resumeBatchId) {
      const existing = batchesStore.get(resumeBatchId);
      if (existing && (existing.status === 'pending' || existing.status === 'failed' || existing.status === 'paused')) {
        return resumeBatchId;
      }
    }
    return this.createBatch(changes, config, batchName, operator);
  }

  private createBeforeSnapshot(changes: EmployeeChange[]): EmployeeChange[] {
    return changes.map((change) => {
      const employee = getEmployeeById(change.employeeId);
      const beforeData = this.buildFieldSnapshot(
        employee?.departmentId || change.sourceDepartment,
        employee?.positionId || change.targetPosition,
        employee?.managerId || change.newManagerId,
        employee?.costCenter || '',
        employee?.attendanceGroup || 'AT-STD'
      );
      return {
        ...change,
        status: 'pending',
        employeeName: employee?.name || change.employeeName,
        originalData: beforeData,
      };
    });
  }

  private createAfterSnapshot(changes: EmployeeChange[]): EmployeeChange[] {
    return changes.map((change) => {
      const targetDept = getDepartmentById(change.targetDepartment);
      const targetPos = getPositionById(change.targetPosition);
      const newMgr = change.newManagerId ? getEmployeeById(change.newManagerId) : null;
      const afterData = this.buildFieldSnapshot(
        targetDept?.id || change.targetDepartment,
        targetPos?.id || change.targetPosition,
        newMgr?.id || change.newManagerId,
        targetDept?.costCenter || '',
        targetDept?.id === 'D001' || targetDept?.parentId === 'D001'
          ? 'AT-TECH'
          : targetDept?.id === 'D007'
            ? 'AT-SALES'
            : 'AT-STD'
      );
      return {
        ...change,
        status: 'success',
        targetDepartment: targetDept?.id || change.targetDepartment,
        targetPosition: targetPos?.id || change.targetPosition,
        newManagerId: newMgr?.id || change.newManagerId,
        employeeName: change.employeeName || getEmployeeById(change.employeeId)?.name,
        newManagerName: newMgr?.name || change.newManagerName,
        newData: afterData,
      };
    });
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
    const batch = batchesStore.get(batchId) as BatchRecord | undefined;
    if (!batch) {
      throw new Error(`批次不存在：${batchId}`);
    }

    if (batch.status === 'running' || batch.status === 'completed') {
      const existing = resultsStore.get(batchId);
      if (existing) return existing as ExecutionResult;
    }

    batch.status = 'running';
    batch.currentIndex = 0;
    batchesStore.set(batchId, batch);
    batchesStore.save();

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
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
        }

        if (success) {
          const beforeSnap = beforeSnapshot.find((s) => s.id === change.id);
          const successChange: EmployeeChange = {
            ...change,
            status: 'success',
            employeeName: beforeSnap?.employeeName,
            originalData: beforeSnap?.originalData,
          };
          const targetDept = getDepartmentById(change.targetDepartment);
          const targetPos = getPositionById(change.targetPosition);
          const newMgr = change.newManagerId ? getEmployeeById(change.newManagerId) : null;
          successChange.newData = this.buildFieldSnapshot(
            targetDept?.id || change.targetDepartment,
            targetPos?.id || change.targetPosition,
            newMgr?.id || change.newManagerId,
            targetDept?.costCenter || '',
            targetDept?.id === 'D001' || targetDept?.parentId === 'D001'
              ? 'AT-TECH'
              : targetDept?.id === 'D007'
                ? 'AT-SALES'
                : 'AT-STD'
          );
          successChange.targetDepartment = targetDept?.id || change.targetDepartment;
          successChange.targetPosition = targetPos?.id || change.targetPosition;
          successChange.newManagerId = newMgr?.id || change.newManagerId;
          successChange.newManagerName = newMgr?.name || change.newManagerName;
          successItems.push(successChange);
          const idx = batch.changes.findIndex((c) => c.id === change.id);
          if (idx !== -1) batch.changes[idx] = successChange;
        } else {
          const beforeSnap = beforeSnapshot.find((s) => s.id === change.id);
          const failedChange: EmployeeChange = {
            ...change,
            status: 'failed',
            failReason: lastError,
            employeeName: beforeSnap?.employeeName,
            originalData: beforeSnap?.originalData,
          };
          failedItems.push(failedChange);
          const idx = batch.changes.findIndex((c) => c.id === change.id);
          if (idx !== -1) batch.changes[idx] = failedChange;
        }

        batch.currentIndex = i + batchItems.indexOf(change) + 1;
        batchesStore.set(batchId, batch);
        onProgress?.(batch, batch.currentIndex);
        batchesStore.save();
      }

      if (i + batchSize < batch.changes.length && intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    batch.status = failedItems.length === batch.changes.length && batch.changes.length > 0 ? 'failed' : 'completed';
    batch.completedAt = new Date().toISOString();
    batchesStore.set(batchId, batch);

    const endTime = new Date().toISOString();
    const afterSnapshot = this.createAfterSnapshot(successItems);
    const allItems = [...successItems, ...failedItems];

    const result: ExecutionResult = {
      batchId,
      batchName: batch.name,
      totalCount: batch.changes.length,
      successCount: successItems.length,
      failedCount: failedItems.length,
      rolledBackCount: 0,
      successItems,
      failedItems,
      rolledBackItems: [],
      allItems,
      startTime,
      endTime,
      operator: batch.operator,
      retryAttempts: 0,
    };

    resultsStore.set(batchId, result);

    const rollbackRecord: RollbackRecord = {
      batchId,
      batchName: batch.name,
      operator: batch.operator,
      operationTime: endTime,
      changeCount: successItems.length,
      rolledBackCount: 0,
      riskLevel: this.calculateRiskLevel(successItems.length, failedItems.length),
      beforeSnapshot,
      afterSnapshot,
      rollbackReference: `批次【${batch.name}】于 ${new Date(endTime).toLocaleString('zh-CN')} 执行完成。共处理 ${batch.changes.length} 条异动，成功 ${successItems.length} 条，失败 ${failedItems.length} 条。回滚操作将恢复成功项的原始数据（部门、岗位、主管、成本中心、考勤组），失败项保持不变。`,
      status: 'available',
    };
    rollbacksStore.set(batchId, rollbackRecord);

    batchesStore.save();
    resultsStore.save();
    rollbacksStore.save();
    return result;
  }

  private async processSingleChange(change: EmployeeChange): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 140));

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
    if (rand < 0.04) {
      throw new Error('系统处理异常：事务提交失败，请重试');
    }
  }

  public getBatch(batchId: string): BatchRecord | undefined {
    return batchesStore.get(batchId) as BatchRecord | undefined;
  }

  public getResult(batchId: string): ExecutionResult | undefined {
    return resultsStore.get(batchId) as ExecutionResult | undefined;
  }

  public getRollbackRecord(batchId: string): RollbackRecord | undefined {
    return rollbacksStore.get(batchId) as RollbackRecord | undefined;
  }

  public getAllRollbackRecords(): RollbackRecord[] {
    return (rollbacksStore.values() as RollbackRecord[]).sort(
      (a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime()
    );
  }

  public getAllResults(): ExecutionResult[] {
    return (resultsStore.values() as ExecutionResult[]).sort(
      (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    );
  }

  public getBatchStatus(batchId: string) {
    const batch = this.getBatch(batchId);
    const result = this.getResult(batchId);
    const successCount = batch
      ? batch.changes.filter((c) => c.status === 'success' || c.status === 'rolled_back').length
      : 0;
    const failedCount = batch ? batch.changes.filter((c) => c.status === 'failed').length : 0;
    const total = batch?.changes.length || 0;
    return {
      batch: batch || null,
      result,
      progress: {
        current: batch?.currentIndex || 0,
        total,
        percentage: total > 0 ? Math.round(((batch?.currentIndex || 0) / total) * 100) : 0,
        successCount,
        failedCount,
      },
    };
  }

  public async retryFailedItems(
    batchId: string,
    changeIds?: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<ExecutionResult> {
    const existingResult = resultsStore.get(batchId) as ExecutionResult | undefined;
    const batch = batchesStore.get(batchId) as BatchRecord | undefined;
    if (!existingResult || !batch) {
      throw new Error(`批次不存在：${batchId}`);
    }

    const itemsToRetry = existingResult.failedItems.filter(
      (item) => !changeIds || changeIds.includes(item.id)
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
        const beforeSnap = existingResult.allItems.find((a) => a.id === change.id);
        const successChange: EmployeeChange = {
          ...change,
          status: 'success',
          failReason: undefined,
          originalData: beforeSnap?.originalData,
        };
        const targetDept = getDepartmentById(change.targetDepartment);
        const targetPos = getPositionById(change.targetPosition);
        const newMgr = change.newManagerId ? getEmployeeById(change.newManagerId) : null;
        successChange.newData = this.buildFieldSnapshot(
          targetDept?.id || change.targetDepartment,
          targetPos?.id || change.targetPosition,
          newMgr?.id || change.newManagerId,
          targetDept?.costCenter || '',
          targetDept?.id === 'D001' || targetDept?.parentId === 'D001'
            ? 'AT-TECH'
            : targetDept?.id === 'D007'
              ? 'AT-SALES'
              : 'AT-STD'
        );
        newSuccess.push(successChange);
      } catch (e: any) {
        stillFailed.push({ ...change, failReason: e.message });
      }
      onProgress?.(i + 1, itemsToRetry.length);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const notRetriedFailed = existingResult.failedItems.filter(
      (f) => !itemsToRetry.some((r) => r.id === f.id)
    );
    const updatedSuccess = [...existingResult.successItems, ...newSuccess];
    const updatedFailed = [...notRetriedFailed, ...stillFailed];
    const updatedAll = updatedSuccess.concat(updatedFailed).concat(existingResult.rolledBackItems);

    const newResult: ExecutionResult = {
      ...existingResult,
      successCount: updatedSuccess.length,
      failedCount: updatedFailed.length,
      successItems: updatedSuccess,
      failedItems: updatedFailed,
      allItems: updatedAll,
      endTime: new Date().toISOString(),
      retryAttempts: (existingResult.retryAttempts || 0) + 1,
    };

    resultsStore.set(batchId, newResult);

    batch.changes = batch.changes.map((c) => {
      const success = updatedSuccess.find((s) => s.id === c.id);
      if (success) return success;
      const failed = updatedFailed.find((f) => f.id === c.id);
      if (failed) return failed;
      return c;
    });
    batchesStore.set(batchId, batch);

    const rollback = rollbacksStore.get(batchId) as RollbackRecord | undefined;
    if (rollback) {
      rollback.afterSnapshot = this.createAfterSnapshot(updatedSuccess);
      rollback.changeCount = updatedSuccess.length;
      rollback.riskLevel = this.calculateRiskLevel(updatedSuccess.length, updatedFailed.length);
      rollback.rollbackReference = `批次【${batch.name}】于 ${new Date().toLocaleString('zh-CN')} 重试完成（第 ${(existingResult.retryAttempts || 0) + 1} 次重试）。累计成功 ${updatedSuccess.length} 条，失败 ${updatedFailed.length} 条，已撤回 ${existingResult.rolledBackCount} 条。`;
      rollback.status = rollback.status === 'rolled_back' ? 'rolled_back' : 'available';
      rollbacksStore.set(batchId, rollback);
    }

    batchesStore.save();
    resultsStore.save();
    rollbacksStore.save();
    return newResult;
  }

  public async executeRollback(batchId: string): Promise<{
    success: boolean;
    message: string;
    rolledBackCount: number;
    updatedResult?: ExecutionResult;
  }> {
    const rollback = rollbacksStore.get(batchId) as RollbackRecord | undefined;
    const result = resultsStore.get(batchId) as ExecutionResult | undefined;
    const batch = batchesStore.get(batchId) as BatchRecord | undefined;

    if (!rollback || !result) {
      return { success: false, message: '批次不存在或已过期', rolledBackCount: 0 };
    }

    if (rollback.status === 'rolled_back') {
      return { success: false, message: '该批次已执行过回滚操作', rolledBackCount: 0 };
    }

    rollback.status = 'rollback_in_progress';
    rollbacksStore.set(batchId, rollback);
    rollbacksStore.save();

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const itemsToRollback = result.successItems.filter((item) => item.status !== 'rolled_back');
    const rollbackCount = itemsToRollback.length;

    const rolledBackItems = itemsToRollback.map((item) => ({
      ...item,
      status: 'rolled_back' as const,
    }));

    const remainingSuccess = result.successItems.filter(
      (item) => item.status !== 'rolled_back' && !itemsToRollback.some((r) => r.id === item.id)
    );

    const updatedRolledBack = [...result.rolledBackItems, ...rolledBackItems];
    const updatedAll = remainingSuccess.concat(result.failedItems).concat(updatedRolledBack);

    const updatedResult: ExecutionResult = {
      ...result,
      successCount: remainingSuccess.length,
      rolledBackCount: updatedRolledBack.length,
      successItems: remainingSuccess,
      rolledBackItems: updatedRolledBack,
      allItems: updatedAll,
      endTime: new Date().toISOString(),
    };

    resultsStore.set(batchId, updatedResult);

    if (batch) {
      batch.changes = batch.changes.map((c) => {
        const rb = rolledBackItems.find((r) => r.id === c.id);
        return rb || c;
      });
      batchesStore.set(batchId, batch);
    }

    rollback.status = 'rolled_back';
    rollback.executedAt = new Date().toISOString();
    rollback.rolledBackCount = rollbackCount;
    rollback.rollbackReference += ` 【已于 ${new Date().toLocaleString('zh-CN')} 完成回滚，恢复 ${rollbackCount} 条记录：部门/岗位/主管/成本中心/考勤组已全部还原为变更前原值】`;
    rollbacksStore.set(batchId, rollback);

    batchesStore.save();
    resultsStore.save();
    rollbacksStore.save();

    return {
      success: true,
      message: `回滚成功，共恢复 ${rollbackCount} 条员工异动数据（部门、岗位、主管、成本中心、考勤组已全部还原）`,
      rolledBackCount: rollbackCount,
      updatedResult,
    };
  }
}

export const batchExecutionService = new BatchExecutionService();
