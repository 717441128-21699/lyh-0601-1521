import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  StopCircle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  TimerReset,
  FileWarning,
  Loader2,
  Users,
  CheckCheck,
  AlertTriangle,
  Zap,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Undo2
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';
import type { EmployeeChange, BatchExecutionConfig } from '../../shared/types';

export default function BatchExecute() {
  const navigate = useNavigate();
  const [showConfig, setShowConfig] = useState(true);
  const [batchName, setBatchName] = useState(`2026年Q2组织调整-${new Date().toLocaleDateString('zh-CN')}`);
  const [selectedFailedIds, setSelectedFailedIds] = useState<Set<string>>(new Set());
  const [expandedFailed, setExpandedFailed] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>('pending');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    validChanges, changes, validCount,
    executionConfig, setExecutionConfig,
    executeBatch, retryFailedItems,
    isLoading, currentExecutionResult,
    executionId, getBatchStatus, fetchReport,
  } = useHRStore();

  const validItems = validChanges.length > 0 ? validChanges : changes.filter(c => !c.errors || c.errors.length === 0);
  const result = currentExecutionResult;

  useEffect(() => {
    if (executionId) {
      setCurrentBatchId(executionId);
    }
  }, [executionId]);

  useEffect(() => {
    if (currentExecutionResult?.batchId && !currentBatchId) {
      setCurrentBatchId(currentExecutionResult.batchId);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentBatchId) {
      stopPolling();
      return;
    }

    const doPoll = async () => {
      const statusRes = await getBatchStatus(currentBatchId);
      if (statusRes?.batch) {
        setBatchStatus(statusRes.batch.status);
        if (statusRes.batch.status === 'completed' || statusRes.batch.status === 'failed') {
          stopPolling();
        }
      }
    };

    doPoll();

    pollingRef.current = setInterval(doPoll, 2000);

    return () => {
      stopPolling();
    };
  }, [currentBatchId, getBatchStatus, stopPolling]);

  useEffect(() => {
    if (result?.batchId) {
      if (result.successCount + result.failedCount >= result.totalCount) {
        setBatchStatus('completed');
        stopPolling();
      } else {
        setBatchStatus('running');
      }
    }
  }, [result, stopPolling]);

  const runBatch = async () => {
    if (batchStatus === 'running') return;
    if (batchStatus === 'completed') {
      navigate('/report');
      return;
    }
    setExecutionLog(['开始执行批量提交...', `批次名称：${batchName}`, `待处理数量：${validItems.length} 条`]);
    const resumeId = currentBatchId || executionId || undefined;
    const res = await executeBatch(batchName, resumeId);
    if (res) {
      setBatchStatus('running');
      setCurrentBatchId(res.batchId);
      setExecutionLog(prev => [...prev,
        `执行完成！成功 ${res.successCount} 条，失败 ${res.failedCount} 条`,
        `批次ID：${res.batchId}`,
        `开始时间：${new Date(res.startTime).toLocaleString('zh-CN')}`,
        `结束时间：${new Date(res.endTime).toLocaleString('zh-CN')}`,
      ]);
      fetchReport(res.batchId);
    }
  };

  const retryAll = async () => {
    if (!result || !currentBatchId) return;
    setExecutionLog(prev => [...prev, '---', `开始重试 ${result.failedCount} 条失败记录...`]);
    const res = await retryFailedItems(result.batchId);
    if (res) {
      setExecutionLog(prev => [...prev,
        `重试完成！当前成功 ${res.successCount} 条，剩余失败 ${res.failedCount} 条`,
      ]);
      await fetchReport(currentBatchId);
    }
  };

  const retrySelected = async () => {
    if (!result || selectedFailedIds.size === 0 || !currentBatchId) return;
    setExecutionLog(prev => [...prev, '---', `开始重试选中的 ${selectedFailedIds.size} 条记录...`]);
    const res = await retryFailedItems(result.batchId, Array.from(selectedFailedIds));
    if (res) {
      setSelectedFailedIds(new Set());
      setExecutionLog(prev => [...prev, `重试完成！`]);
      await fetchReport(currentBatchId);
    }
  };

  const retrySingle = async (itemId: string) => {
    if (!result || !currentBatchId) return;
    setExecutionLog(prev => [...prev, '---', `重试单条记录：${itemId}`]);
    const res = await retryFailedItems(result.batchId, [itemId]);
    if (res) {
      setExecutionLog(prev => [...prev, `单条重试完成！`]);
      await fetchReport(currentBatchId);
    }
  };

  const totalCount = result?.totalCount || 0;
  const successCount = result?.successCount || 0;
  const failedCount = result?.failedCount || 0;
  const pendingCount = Math.max(0, totalCount - successCount - failedCount);
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((successCount + failedCount) / totalCount * 100)) : 0;
  const successPercent = totalCount > 0 ? Math.min(100, Math.round(successCount / totalCount * 100)) : 0;
  const failedPercent = totalCount > 0 ? Math.min(100, Math.round(failedCount / totalCount * 100)) : 0;
  const pendingPercent = Math.max(0, 100 - successPercent - failedPercent);

  const displayBatchId = currentBatchId || executionId || result?.batchId;
  const hasBatch = !!displayBatchId;

  const getStatusLabel = () => {
    if (!hasBatch) return '待提交';
    switch (batchStatus) {
      case 'running': return '执行中';
      case 'completed': return '已完成';
      case 'failed': return '已失败';
      case 'pending': return '待提交';
      default: return '待提交';
    }
  };

  const getStatusColor = () => {
    if (!hasBatch) return 'text-slate-500 bg-slate-100';
    switch (batchStatus) {
      case 'running': return 'text-primary-700 bg-primary-100';
      case 'completed': return 'text-success-700 bg-success-100';
      case 'failed': return 'text-danger-700 bg-danger-100';
      default: return 'text-slate-500 bg-slate-100';
    }
  };

  const getButtonConfig = () => {
    if (!hasBatch) {
      return {
        onClick: runBatch,
        disabled: isLoading || validItems.length === 0,
        label: '开始批量提交',
        icon: isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />,
        className: 'btn-success',
      };
    }
    if (batchStatus === 'running') {
      return {
        onClick: () => {},
        disabled: true,
        label: '执行中...',
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        className: 'btn-success',
      };
    }
    if (batchStatus === 'completed') {
      return {
        onClick: () => navigate('/report'),
        disabled: false,
        label: '查看报告',
        icon: <FileText className="w-4 h-4" />,
        className: 'btn-primary',
      };
    }
    return {
      onClick: runBatch,
      disabled: isLoading || validItems.length === 0,
      label: '开始批量提交',
      icon: isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />,
      className: 'btn-success',
    };
  };

  const buttonConfig = getButtonConfig();

  const displayBatchName = result?.batchName || batchName;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/impact')} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            返回影响分析
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">批量提交执行</h1>
            <p className="text-sm text-slate-500">分批提交异动数据，支持失败项重试</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/report')} className="btn-secondary">
            <FileText className="w-4 h-4" />
            查看报告中心
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-5">
          {showConfig && !result && (
            <div className="card p-6 animate-slide-up animate-stagger-1">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-200">
                    <Settings className="w-5.5 h-5.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">执行配置</h3>
                    <p className="text-xs text-slate-500">设置批量提交的参数</p>
                  </div>
                </div>
                <button onClick={() => setShowConfig(false)} className="btn-ghost text-xs">
                  <ChevronUp className="w-4 h-4" />
                  收起
                </button>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="label">批次名称</label>
                  {hasBatch ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">批次号</p>
                            <p className="font-mono text-sm font-semibold text-primary-700">{displayBatchId}</p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor()}`}>
                            {getStatusLabel()}
                          </span>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="input-base bg-slate-50 cursor-not-allowed"
                        value={displayBatchName}
                        readOnly
                        disabled
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="input-base"
                      value={batchName}
                      onChange={e => setBatchName(e.target.value)}
                    />
                  )}
                </div>

                <ConfigItem
                  icon={Layers}
                  label="批次大小"
                  value={executionConfig.batchSize}
                  suffix="条/批"
                  options={[5, 10, 20, 50]}
                  onChange={v => setExecutionConfig({ batchSize: v })}
                />
                <ConfigItem
                  icon={TimerReset}
                  label="批次间隔"
                  value={executionConfig.intervalMs}
                  suffix="毫秒"
                  options={[0, 200, 500, 1000, 2000]}
                  onChange={v => setExecutionConfig({ intervalMs: v })}
                />
                <ConfigItem
                  icon={RefreshCw}
                  label="自动重试"
                  value={executionConfig.retryCount}
                  suffix="次"
                  options={[0, 1, 2, 3]}
                  onChange={v => setExecutionConfig({ retryCount: v })}
                  description="失败后自动重试的次数"
                />
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-info-50 border border-primary-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary-600" />
                    <span className="text-sm font-semibold text-primary-800">预估执行信息</span>
                  </div>
                  <div className="space-y-1 text-xs text-primary-700">
                    <p>• 共 <b>{validItems.length}</b> 条数据，分 <b>{Math.ceil(validItems.length / executionConfig.batchSize)}</b> 批提交</p>
                    <p>• 预计耗时 <b>{Math.ceil(validItems.length / executionConfig.batchSize) * (executionConfig.intervalMs + executionConfig.batchSize * 150) / 1000}</b> 秒</p>
                    <p>• 每条记录预留 <b>{executionConfig.retryCount}</b> 次重试机会</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showConfig && !result && (
            <div className="card p-4 animate-slide-up flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-slate-500" />
                <span className="text-sm text-slate-600">
                  批次大小 {executionConfig.batchSize}条 · 间隔 {executionConfig.intervalMs}ms · 重试 {executionConfig.retryCount}次
                </span>
              </div>
              <button onClick={() => setShowConfig(true)} className="btn-ghost text-xs">
                <Settings className="w-4 h-4" />
                修改配置
              </button>
            </div>
          )}

          <div className="card animate-slide-up animate-stagger-2">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-800">执行进度</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {hasBatch ? (
                      <>
                        <span>批次号：<span className="font-mono font-semibold text-primary-700">{displayBatchId}</span></span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{
                          backgroundColor: batchStatus === 'running' ? '#dbeafe' : batchStatus === 'completed' ? '#dcfce7' : batchStatus === 'failed' ? '#fee2e2' : '#f1f5f9',
                          color: batchStatus === 'running' ? '#1d4ed8' : batchStatus === 'completed' ? '#15803d' : batchStatus === 'failed' ? '#b91c1c' : '#64748b'
                        }}>
                          {getStatusLabel()}
                        </span>
                        {result?.batchName && <span>· {result.batchName}</span>}
                      </>
                    ) : (
                      validItems.length > 0 ? `待提交 ${validItems.length} 条异动数据` : '暂无可提交数据'
                    )}
                  </p>
                </div>
                {!result && validItems.length > 0 && !hasBatch && (
                  <button
                    onClick={buttonConfig.onClick}
                    disabled={buttonConfig.disabled}
                    className={buttonConfig.className}
                  >
                    {buttonConfig.icon}
                    {buttonConfig.label}
                  </button>
                )}
                {hasBatch && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={buttonConfig.onClick}
                      disabled={buttonConfig.disabled}
                      className={buttonConfig.className}
                    >
                      {buttonConfig.icon}
                      {buttonConfig.label}
                    </button>
                    {batchStatus === 'completed' && (
                      <button onClick={() => {
                        setCurrentBatchId(null);
                        setBatchStatus('pending');
                      }} className="btn-secondary text-xs">
                        <RefreshCw className="w-3.5 h-3.5" />
                        新批次
                      </button>
                    )}
                  </div>
                )}
                {!hasBatch && result && (
                  <div className="flex items-center gap-2">
                    <button onClick={runBatch} className="btn-secondary text-xs">
                      <RefreshCw className="w-3.5 h-3.5" />
                      新批次
                    </button>
                  </div>
                )}
              </div>

              {result ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <ProgressMiniCard
                      label="成功"
                      value={`${successCount}条`}
                      percent={successPercent}
                      color="success"
                      icon={CheckCircle2}
                    />
                    <ProgressMiniCard
                      label="失败"
                      value={`${failedCount}条`}
                      percent={failedPercent}
                      color="danger"
                      icon={XCircle}
                    />
                    <ProgressMiniCard
                      label="待处理"
                      value={`${pendingCount}条`}
                      percent={pendingPercent}
                      color="primary"
                      icon={Clock}
                    />
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-success-400 to-success-600 transition-all duration-500"
                        style={{ width: `${successPercent}%` }}
                      />
                      <div
                        className="absolute top-0 h-full bg-gradient-to-r from-danger-400 to-danger-600 transition-all duration-500"
                        style={{ width: `${failedPercent}%`, left: `${successPercent}%` }}
                      />
                      <div
                        className="absolute top-0 h-full bg-gradient-to-r from-primary-300 to-primary-500 transition-all duration-500"
                        style={{ width: `${pendingPercent}%`, left: `${successPercent + failedPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success-500" /> 成功 {successPercent}%</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-400" /> 待处理 {pendingPercent}%</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger-500" /> 失败 {failedPercent}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <span className="text-slate-500">操作人：</span>
                      <span className="font-semibold text-slate-700">{result.operator}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <span className="text-slate-500">开始时间：</span>
                      <span className="font-semibold text-slate-700">{new Date(result.startTime).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <span className="text-slate-500">耗时：</span>
                      <span className="font-semibold text-slate-700">
                        {Math.round((new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000)}秒
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <Gauge className="w-10 h-10 text-slate-300" />
                  </div>
                  {validItems.length > 0 ? (
                    <>
                      <p className="text-sm font-semibold text-slate-700 mb-1">准备就绪</p>
                      <p className="text-xs text-slate-500">点击「开始批量提交」按钮开始执行</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-500 mb-1">暂无可提交数据</p>
                      <p className="text-xs text-slate-400 mb-4">请先在主工作台完成数据校验</p>
                      <button onClick={() => navigate('/')} className="btn-primary text-xs">
                        前往工作台
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {result && result.failedCount > 0 && (
            <div className="card animate-slide-up animate-stagger-3">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-danger-50 flex items-center justify-center">
                    <FileWarning className="w-5 h-5 text-danger-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">失败项处理</h3>
                    <p className="text-xs text-slate-500">共 {result.failedCount} 条失败，可单独或批量重试</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFailedIds.size > 0 && (
                    <button onClick={retrySelected} className="btn-warning text-xs" disabled={isLoading}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      重试选中 ({selectedFailedIds.size})
                    </button>
                  )}
                  <button onClick={retryAll} className="btn-danger text-xs" disabled={isLoading}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    重试全部
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-auto scrollbar-thin">
                {result.failedItems.map((item, idx) => {
                  const isExpanded = expandedFailed === item.id;
                  const isSelected = selectedFailedIds.has(item.id);
                  return (
                    <div key={item.id} className={`px-6 py-4 transition-colors ${isSelected ? 'bg-warning-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          checked={isSelected}
                          onChange={e => {
                            const next = new Set(selectedFailedIds);
                            e.target.checked ? next.add(item.id) : next.delete(item.id);
                            setSelectedFailedIds(next);
                          }}
                        />
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-danger-400 to-danger-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(item.employeeName || item.employeeId).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{item.employeeName || item.employeeId}</span>
                            <span className="font-mono text-xs text-slate-500">{item.employeeId}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {item.failReason || '未知错误'}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedFailed(isExpanded ? null : item.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        <button
                          onClick={() => retrySingle(item.id)}
                          className="btn-secondary text-xs"
                          disabled={isLoading}
                        >
                          <RefreshCw className="w-3 h-3" />
                          重试
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 ml-13 pl-13 animate-slide-up">
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">详细信息</p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <InfoRow label="原部门" value={item.sourceDepartment} />
                              <InfoRow label="新部门" value={item.targetDepartment} />
                              <InfoRow label="新岗位" value={item.targetPosition} />
                              <InfoRow label="新主管" value={item.newManagerName || item.newManagerId} />
                              <InfoRow label="生效日期" value={item.effectiveDate} />
                              <InfoRow label="错误原因" value={item.failReason || '-'} error />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-4 space-y-5">
          <div className="card p-5 animate-slide-up animate-stagger-1">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-700" />
              待提交概览
            </h3>
            <div className="space-y-3">
              <StatRow label="待处理总数" value={validItems.length} total={validItems.length} color="primary" />
              <StatRow label="涉及部门" value={new Set(validItems.map(c => c.targetDepartment)).size} total={9} color="info" />
              <StatRow label="涉及岗位调整" value={validItems.filter(c => c.targetPosition).length} total={validItems.length} color="success" />
              <StatRow label="汇报关系变更" value={validItems.filter(c => c.newManagerId).length} total={validItems.length} color="warning" />
            </div>
          </div>

          <div className="card p-5 animate-slide-up animate-stagger-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-info-700" />
                执行日志
              </h3>
              {executionLog.length > 0 && (
                <button onClick={() => setExecutionLog([])} className="text-xs text-slate-400 hover:text-danger-600">
                  清空
                </button>
              )}
            </div>
            <div className="h-64 overflow-auto scrollbar-thin bg-slate-900 rounded-lg p-4 font-mono text-xs space-y-1">
              {executionLog.length === 0 ? (
                <p className="text-slate-500">等待执行...</p>
              ) : (
                executionLog.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">{new Date().toLocaleTimeString('zh-CN')}</span>
                    <span className={log.includes('成功') ? 'text-success-400' : log.includes('失败') ? 'text-danger-400' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {result && (
            <div className="card p-5 animate-slide-up animate-stagger-3 space-y-3">
              <button
                onClick={() => navigate('/report')}
                className="w-full btn-primary"
              >
                <FileText className="w-4 h-4" />
                查看详细报告
              </button>
              <button
                onClick={() => navigate('/rollback')}
                className="w-full btn-secondary"
              >
                <Undo2 className="w-4 h-4" />
                前往回滚中心
              </button>
              <button className="w-full btn-ghost border border-dashed border-slate-300">
                <Download className="w-4 h-4" />
                导出执行结果
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigItem({ icon: Icon, label, value, suffix, options, onChange, description }: {
  icon: any; label: string; value: number; suffix: string;
  options: number[]; onChange: (v: number) => void; description?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
        <span className="text-lg font-bold text-primary-700">{value}<span className="text-xs text-slate-400 ml-0.5 font-normal">{suffix}</span></span>
      </div>
      {description && <p className="text-xs text-slate-500 mb-3">{description}</p>}
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              value === opt
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressMiniCard({ label, value, percent, color, icon: Icon }: {
  label: string; value: string; percent: number; color: 'primary' | 'success' | 'danger'; icon: any;
}) {
  const colors = {
    primary: 'from-primary-500 to-primary-700 bg-primary-50 text-primary-700',
    success: 'from-success-500 to-success-700 bg-success-50 text-success-700',
    danger: 'from-danger-500 to-danger-700 bg-danger-50 text-danger-700',
  };
  const [grad, bg, text] = colors[color].split(' ');
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${text}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${text} mb-2`}>{value}</p>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${grad} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorMap: Record<string, string> = {
    primary: 'from-primary-400 to-primary-600',
    success: 'from-success-400 to-success-600',
    warning: 'from-warning-400 to-warning-600',
    info: 'from-info-400 to-info-600',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-sm font-bold text-slate-800">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${colorMap[color]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, error }: { label: string; value: string; error?: boolean }) {
  return (
    <div>
      <span className="text-slate-500">{label}：</span>
      <span className={`font-semibold ${error ? 'text-danger-700' : 'text-slate-800'}`}>{value || '-'}</span>
    </div>
  );
}
