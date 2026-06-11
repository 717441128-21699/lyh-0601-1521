import { Router } from 'express';
import type { ValidateRequest, PreviewRequest, ExecuteRequest } from '../../shared/types';
import { validationService } from '../services/ValidationService';
import { impactAnalysisService } from '../services/ImpactAnalysisService';
import { batchExecutionService } from '../services/BatchExecutionService';
import { DEPARTMENTS, POSITIONS, EMPLOYEES } from '../data/masterData';

const router = Router();

router.post('/validate', (req, res) => {
  try {
    const { changes } = req.body as ValidateRequest;
    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: '请求参数错误：changes 应为数组' });
    }
    const { validChanges, invalidChanges } = validationService.validateAll(changes);
    const summary = {
      total: changes.length,
      valid: validChanges.length,
      invalid: invalidChanges.length,
      errorsByType: validationService.getErrorSummary(invalidChanges),
    };
    res.json({ validChanges, invalidChanges, summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '校验服务异常' });
  }
});

router.post('/preview', (req, res) => {
  try {
    const { changes } = req.body as PreviewRequest;
    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: '请求参数错误' });
    }
    const impact = impactAnalysisService.analyze(changes);
    const summary = impactAnalysisService.getSummary(impact);
    res.json({ impact, summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '影响分析服务异常' });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { changes, config, batchName } = req.body as ExecuteRequest;
    if (!changes || !Array.isArray(changes) || !config) {
      return res.status(400).json({ error: '请求参数错误' });
    }
    const batchId = batchExecutionService.createBatch(changes, config, batchName);
    res.json({ executionId: batchId, config });

    setImmediate(async () => {
      try {
        await batchExecutionService.executeBatch(batchId);
      } catch (e) {
        console.error('Batch execution error:', e);
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '执行服务异常' });
  }
});

router.post('/execute/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await batchExecutionService.executeBatch(batchId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '批次执行失败' });
  }
});

router.get('/status/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = batchExecutionService.getBatch(batchId);
    const result = batchExecutionService.getResult(batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        config: batch.config,
        currentIndex: batch.currentIndex,
        total: batch.changes.length,
        createdAt: batch.createdAt,
      },
      result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/retry/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { changeIds } = req.body as { changeIds?: string[] };
    const result = await batchExecutionService.retryFailedItems(batchId, changeIds);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '重试失败' });
  }
});

router.get('/report/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const result = batchExecutionService.getResult(batchId);
    const rollbackInfo = batchExecutionService.getRollbackRecord(batchId);
    if (!result) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ result, rollbackInfo });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reports', (_req, res) => {
  try {
    const reports = batchExecutionService.getAllResults();
    res.json(reports);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rollbacks', (_req, res) => {
  try {
    const records = batchExecutionService.getAllRollbackRecords();
    res.json(records);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rollback/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const record = batchExecutionService.getRollbackRecord(batchId);
    if (!record) {
      return res.status(404).json({ error: '回滚记录不存在' });
    }
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rollback/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await batchExecutionService.executeRollback(batchId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '回滚失败' });
  }
});

router.get('/masterdata', (_req, res) => {
  res.json({
    departments: DEPARTMENTS,
    positions: POSITIONS,
    employees: EMPLOYEES,
  });
});

export default router;
