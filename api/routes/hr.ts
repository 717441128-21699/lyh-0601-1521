import { Router } from 'express';
import type {
  ValidateRequest,
  PreviewRequest,
  ExecuteRequest,
  ApplyMappingRequest,
} from '../../shared/types';
import { validationService } from '../services/ValidationService';
import { impactAnalysisService } from '../services/ImpactAnalysisService';
import { batchExecutionService } from '../services/BatchExecutionService';
import { importPrecheckService } from '../services/ImportPrecheckService';
import { DEPARTMENTS, POSITIONS, EMPLOYEES } from '../data/masterData';

const router = Router();

router.post('/precheck', (req, res) => {
  try {
    const { csvContent, filename } = req.body as { csvContent: string; filename?: string };
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV 内容不能为空' });
    }
    const result = importPrecheckService.precheckCSV(csvContent, filename);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '数据预检服务异常' });
  }
});

router.post('/apply-mapping', (req, res) => {
  try {
    const { csvContent, mapping, dateOverrides } = req.body as {
      csvContent: string;
    } & ApplyMappingRequest;
    if (!csvContent || !mapping) {
      return res.status(400).json({ error: '参数错误' });
    }
    const changes = importPrecheckService.applyMappingAndParse(csvContent, mapping, dateOverrides);
    res.json({ changes });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '字段映射应用失败' });
  }
});

router.get('/template', (_req, res) => {
  const csv = importPrecheckService.generateTemplateCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="HR异动导入模板.csv"');
  res.send('\uFEFF' + csv);
});

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
    const { changes, config, batchName, resumeBatchId } = req.body as ExecuteRequest;
    if (!changes || !Array.isArray(changes) || !config) {
      return res.status(400).json({ error: '请求参数错误' });
    }
    const batchId = batchExecutionService.getOrCreateBatch(
      resumeBatchId,
      changes,
      config,
      batchName
    );
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
    const status = batchExecutionService.getBatchStatus(batchId);
    if (!status.batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batch/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = batchExecutionService.getBatch(batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({ batch });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches', (_req, res) => {
  try {
    const results = batchExecutionService.getAllResults();
    const rollbacks = batchExecutionService.getAllRollbackRecords();
    const batches = results.map((r) => {
      const rollback = rollbacks.find((rb) => rb.batchId === r.batchId);
      return {
        batchId: r.batchId,
        batchName: r.batchName,
        totalCount: r.totalCount,
        successCount: r.successCount,
        failedCount: r.failedCount,
        rolledBackCount: r.rolledBackCount,
        successRate: r.totalCount > 0 ? Math.round(((r.successCount + r.rolledBackCount) / r.totalCount) * 100) : 0,
        status: rollback?.status || 'available',
        endTime: r.endTime,
        operator: r.operator,
      };
    });
    res.json(batches);
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
    const batchInfo = batchExecutionService.getBatch(batchId);
    if (!result) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ result, rollbackInfo, batchInfo });
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
    const result = batchExecutionService.getResult(batchId);
    if (!record) {
      return res.status(404).json({ error: '回滚记录不存在' });
    }
    res.json({ record, result });
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
