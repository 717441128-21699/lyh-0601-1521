import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Undo2,
  History,
  ShieldAlert,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  FileText,
  Loader2,
  RefreshCw,
  Database,
  GitPullRequest,
  Search,
  Filter,
  X,
  Zap,
  Info
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';
import type { RollbackRecord, ChangeFieldSnapshot } from '../../shared/types';

const COMPARE_FIELDS: Array<{ key: keyof ChangeFieldSnapshot; label: string }> = [
  { key: 'departmentName', label: '部门' },
  { key: 'positionName', label: '岗位' },
  { key: 'managerName', label: '主管' },
  { key: 'costCenter', label: '成本中心' },
  { key: 'attendanceGroup', label: '考勤组' },
];

export default function RollbackCenter() {
  const navigate = useNavigate();
  const [selectedRecord, setSelectedRecord] = useState<RollbackRecord | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<{ success: boolean; message: string } | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const {
    rollbackRecords, fetchRollbackRecords, fetchRollbackRecord,
    executeRollback, isLoading, selectedRollbackRecord, setSelectedRollbackRecord,
    fetchReport, currentExecutionResult, batchSummaryList, fetchBatchList,
  } = useHRStore();

  useEffect(() => {
    fetchRollbackRecords();
    fetchBatchList();
  }, [fetchRollbackRecords, fetchBatchList]);

  const handleSelectRecord = (record: RollbackRecord) => {
    setSelectedRecord(record);
    fetchRollbackRecord(record.batchId);
  };

  const handleConfirmRollback = async () => {
    if (!selectedRecord) return;
    const res = await executeRollback(selectedRecord.batchId);
    setRollbackResult(res);
    setShowConfirmModal(false);
    if (res.success) {
      fetchRollbackRecords();
      fetchBatchList();
      fetchRollbackRecord(selectedRecord.batchId);
      setSelectedRecord(null);
    }
  };

  const getBatchFailedCount = (batchId: string) => {
    const batch = batchSummaryList.find(b => b.batchId === batchId);
    return batch?.failedCount ?? 0;
  };

  const filteredRecords = filterRisk === 'all'
    ? rollbackRecords
    : rollbackRecords.filter(r => r.riskLevel === filterRisk);

  const activeRecord = selectedRollbackRecord || selectedRecord;

  const isRolledBack = (record: RollbackRecord) => record.status === 'rolled_back';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-xl font-bold text-slate-800">回滚中心</h1>
          <p className="text-sm text-slate-500">查看历史变更记录，支持撤回操作</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              className="bg-transparent text-sm text-slate-600 focus:outline-none"
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value)}
            >
              <option value="all">全部风险等级</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </select>
          </div>
          <button onClick={() => { fetchRollbackRecords(); fetchBatchList(); }} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="变更批次总数"
          value={rollbackRecords.length}
          icon={History}
          color="primary"
          animateIdx={1}
        />
        <StatCard
          label="累计变更记录"
          value={rollbackRecords.reduce((s, r) => s + r.changeCount, 0)}
          icon={Users}
          color="info"
          animateIdx={2}
        />
        <StatCard
          label="已执行回滚"
          value={rollbackRecords.filter(r => r.status === 'rolled_back').length}
          icon={Undo2}
          color="success"
          animateIdx={3}
        />
        <StatCard
          label="高风险批次"
          value={rollbackRecords.filter(r => r.riskLevel === 'high').length}
          icon={ShieldAlert}
          color="danger"
          animateIdx={4}
        />
      </div>

      {rollbackResult && (
        <div className={`card p-4 flex items-center gap-3 animate-slide-up ${
          rollbackResult.success ? 'border-success-200 bg-success-50' : 'border-danger-200 bg-danger-50'
        }`}>
          {rollbackResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0" />
          )}
          <p className={`text-sm ${rollbackResult.success ? 'text-success-800' : 'text-danger-800'}`}>
            {rollbackResult.message}
          </p>
          <button onClick={() => setRollbackResult(null)} className="ml-auto">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="card p-12 text-center animate-slide-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">暂无变更记录</p>
              <p className="text-xs text-slate-500 mb-4">执行批量提交后将在此处显示历史记录</p>
              <button onClick={() => navigate('/execute')} className="btn-primary text-xs">
                前往执行
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            filteredRecords.map((record, idx) => {
              const rolled = isRolledBack(record);
              const failedCount = getBatchFailedCount(record.batchId);
              return (
                <button
                  key={record.batchId}
                  onClick={() => handleSelectRecord(record)}
                  className={`w-full text-left card p-5 transition-all duration-300 animate-slide-up hover:shadow-card-hover ${
                    activeRecord?.batchId === record.batchId
                      ? rolled ? 'ring-2 ring-slate-400 shadow-card-hover' : 'ring-2 ring-primary-500 shadow-card-hover'
                      : ''
                  } ${rolled ? 'opacity-80 bg-slate-50/60' : ''}`}
                  style={{ animationDelay: `${(idx % 6) * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${
                        rolled
                          ? 'bg-slate-200 text-slate-600'
                          : record.riskLevel === 'high'
                          ? 'bg-danger-100 text-danger-700'
                          : record.riskLevel === 'medium'
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-success-100 text-success-700'
                      }`}>
                        {rolled ? (
                          <CheckCircle2 className="w-5.5 h-5.5" />
                        ) : (
                          <GitPullRequest className="w-5.5 h-5.5" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {record.batchName}
                          {rolled && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                              已撤回{record.rolledBackCount}条
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{record.batchId.slice(-10)}</div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-all ${
                      activeRecord?.batchId === record.batchId
                        ? rolled ? 'text-slate-500 translate-x-1' : 'text-primary-600 translate-x-1'
                        : 'text-slate-400'
                    }`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-slate-50 text-center">
                      <p className="text-lg font-bold text-slate-800">{record.changeCount}</p>
                      <p className="text-[10px] text-slate-500">变更</p>
                    </div>
                    <div className="p-2 rounded-lg bg-success-50 text-center">
                      <p className="text-lg font-bold text-success-700">{record.rolledBackCount}</p>
                      <p className="text-[10px] text-slate-500">撤回</p>
                    </div>
                    <div className="p-2 rounded-lg bg-danger-50 text-center">
                      <p className="text-lg font-bold text-danger-700">{failedCount}</p>
                      <p className="text-[10px] text-slate-500">失败</p>
                    </div>
                  </div>

                  <div className={`p-2 rounded-lg mb-3 text-center ${
                    rolled ? 'bg-slate-100' :
                    record.riskLevel === 'high' ? 'bg-danger-50' :
                    record.riskLevel === 'medium' ? 'bg-warning-50' : 'bg-success-50'
                  }`}>
                    <p className={`text-sm font-bold ${
                      rolled ? 'text-slate-700' :
                      record.riskLevel === 'high' ? 'text-danger-700' :
                      record.riskLevel === 'medium' ? 'text-warning-700' : 'text-success-700'
                    }`}>
                      {rolled ? '已撤回' :
                       record.status === 'available' ? `${record.riskLevel === 'high' ? '高' : record.riskLevel === 'medium' ? '中' : '低'}风险 · 可撤回` :
                       record.status === 'rollback_in_progress' ? '回滚中' : '回滚失败'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(record.operationTime).toLocaleString('zh-CN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {record.operator}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="col-span-7">
          {!activeRecord ? (
            <div className="card p-16 text-center animate-slide-up min-h-[600px] flex flex-col items-center justify-center">
              <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <Database className="w-12 h-12 text-slate-300" />
              </div>
              <p className="text-lg font-bold text-slate-700 mb-2">选择变更记录查看详情</p>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                点击左侧的变更批次卡片，可以查看撤回参考信息、变更前后的快照对比，并执行回滚操作
              </p>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2"><Info className="w-4 h-4" /> 变更前快照</div>
                <div className="flex items-center gap-2"><Info className="w-4 h-4" /> 变更后快照</div>
                <div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> 风险提示</div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-slide-up">
              <div className={`card p-6 ${isRolledBack(activeRecord) ? 'bg-slate-50/60' : ''}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
                      isRolledBack(activeRecord)
                        ? 'bg-slate-200 text-slate-600'
                        : activeRecord.riskLevel === 'high'
                        ? 'bg-gradient-to-br from-danger-400 to-danger-600 text-white'
                        : activeRecord.riskLevel === 'medium'
                        ? 'bg-gradient-to-br from-warning-400 to-warning-600 text-white'
                        : 'bg-gradient-to-br from-success-400 to-success-600 text-white'
                    }`}>
                      <Undo2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold flex items-center gap-2 ${isRolledBack(activeRecord) ? 'text-slate-600' : 'text-slate-800'}`}>
                        {activeRecord.batchName}
                        {isRolledBack(activeRecord) && (
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-300 text-slate-800 font-semibold">
                            已撤回{activeRecord.rolledBackCount}条
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(activeRecord.operationTime).toLocaleString('zh-CN')}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{activeRecord.operator}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { fetchReport(activeRecord.batchId); navigate('/report'); }}
                      className={`text-xs ${isRolledBack(activeRecord) ? 'btn-secondary opacity-70' : 'btn-secondary'}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      查看报告
                    </button>
                    {isRolledBack(activeRecord) ? (
                      <button
                        disabled
                        className="text-xs btn-secondary cursor-not-allowed opacity-70 bg-slate-200 border-slate-300 text-slate-600"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        已撤回
                      </button>
                    ) : (activeRecord.status === 'available' || activeRecord.status === 'rollback_failed') && (
                      <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isLoading}
                        className="btn-danger text-xs"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                        执行回滚
                      </button>
                    )}
                  </div>
                </div>

                {!isRolledBack(activeRecord) && activeRecord.riskLevel !== 'low' && (
                  <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${
                    activeRecord.riskLevel === 'high'
                      ? 'bg-danger-50 border border-danger-200'
                      : 'bg-warning-50 border border-warning-200'
                  }`}>
                    <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${
                      activeRecord.riskLevel === 'high' ? 'text-danger-600' : 'text-warning-600'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-bold mb-1 ${
                        activeRecord.riskLevel === 'high' ? 'text-danger-800' : 'text-warning-800'
                      }`}>
                        {activeRecord.riskLevel === 'high' ? '高风险操作提醒' : '中风险操作提醒'}
                      </p>
                      <p className={`text-xs ${
                        activeRecord.riskLevel === 'high' ? 'text-danger-700' : 'text-warning-700'
                      }`}>
                        本次回滚将恢复 {activeRecord.changeCount} 条员工的异动数据，可能影响已生效的审批流程、考勤统计和财务成本核算。
                        建议在执行回滚前，与相关业务负责人确认并通知受影响人员。
                      </p>
                    </div>
                    <Zap className={`w-5 h-5 ${
                      activeRecord.riskLevel === 'high' ? 'text-danger-500 animate-pulse-soft' : 'text-warning-500'
                    }`} />
                  </div>
                )}

                <div className="mb-6">
                  <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isRolledBack(activeRecord) ? 'text-slate-600' : 'text-slate-800'}`}>
                    <Info className="w-4 h-4 text-info-600" />
                    撤回参考说明
                  </h4>
                  <div className={`p-4 rounded-lg leading-relaxed space-y-2 ${isRolledBack(activeRecord) ? 'bg-slate-100' : 'bg-slate-50'}`}>
                    <p className={`text-sm ${isRolledBack(activeRecord) ? 'text-slate-600' : 'text-slate-600'}`}>
                      {activeRecord.rollbackReference}
                    </p>
                    {activeRecord.executedAt && (
                      <div className={`flex items-center gap-2 pt-2 mt-2 border-t border-slate-200 text-xs ${isRolledBack(activeRecord) ? 'text-slate-500' : 'text-slate-500'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold">执行时间：</span>
                        <span>{new Date(activeRecord.executedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isRolledBack(activeRecord) ? 'text-slate-600' : 'text-slate-800'}`}>
                    <GitPullRequest className={`w-4 h-4 ${isRolledBack(activeRecord) ? 'text-slate-500' : 'text-primary-600'}`} />
                    变更前后对比（前 5 条）
                  </h4>
                  <div className="space-y-3">
                    {activeRecord.afterSnapshot.slice(0, 5).map((after, idx) => {
                      const before = activeRecord.beforeSnapshot[idx] || after;
                      const originalData = before.originalData || (before as any);
                      const newData = after.newData || (after as any);

                      return (
                        <div key={after.id} className={`p-4 rounded-xl border ${isRolledBack(activeRecord) ? 'border-slate-200 bg-slate-50/50' : 'border-slate-100 bg-gradient-to-r from-slate-50/50 via-white to-primary-50/30'}`}>
                          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                            <span className={`text-xs font-semibold ${isRolledBack(activeRecord) ? 'text-slate-600' : 'text-slate-700'}`}>
                              {after.employeeName} ({after.employeeId})
                            </span>
                            <span className={`badge ${
                              after.status === 'success' ? 'bg-success-100 text-success-700' :
                              after.status === 'rolled_back' ? 'bg-slate-200 text-slate-700' :
                              'bg-warning-100 text-warning-700'
                            }`}>
                              {after.status === 'success' ? '已生效' : after.status === 'rolled_back' ? '已回滚' : '状态未知'}
                            </span>
                          </div>

                          <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className={`text-[10px] font-bold uppercase tracking-wider ${isRolledBack(activeRecord) ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'}`}>
                                  <th className="w-[90px] px-3 py-2 text-left border-r border-slate-200 shrink-0">字段</th>
                                  <th className="px-3 py-2 text-left border-r border-slate-200 min-w-[120px]">变更前</th>
                                  <th className="w-[44px] px-2 py-2 text-center border-r border-slate-200 shrink-0"></th>
                                  <th className="px-3 py-2 text-left min-w-[120px]">变更后</th>
                                </tr>
                              </thead>
                              <tbody>
                                {COMPARE_FIELDS.map(({ key, label }) => {
                                  const oldVal = originalData?.[key] ?? '';
                                  const newVal = newData?.[key] ?? '';
                                  const changed = String(oldVal ?? '') !== String(newVal ?? '');
                                  return (
                                    <tr key={key} className="border-t border-slate-100 last:border-t-0">
                                      <td className={`px-3 py-2 text-xs font-semibold border-r border-slate-100 ${isRolledBack(activeRecord) ? 'text-slate-500 bg-slate-50' : 'text-slate-600 bg-slate-50'}`}>
                                        {label}
                                      </td>
                                      <td className={`px-3 py-2 text-xs border-r border-slate-100 ${changed && !isRolledBack(activeRecord) ? 'text-slate-700' : 'text-slate-700'}`}>
                                        <span className={`${changed && !isRolledBack(activeRecord) ? 'bg-success-100 text-success-800 px-2 py-0.5 rounded font-medium' : ''}`}>
                                          {oldVal || '-'}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2 text-center border-r border-slate-100">
                                        <ArrowRight className={`w-4 h-4 mx-auto ${changed && !isRolledBack(activeRecord) ? 'text-success-500' : 'text-slate-300'}`} />
                                      </td>
                                      <td className={`px-3 py-2 text-xs ${changed && !isRolledBack(activeRecord) ? 'text-slate-800' : 'text-slate-700'}`}>
                                        <span className={`${changed && !isRolledBack(activeRecord) ? 'bg-success-100 text-success-800 px-2 py-0.5 rounded font-medium' : ''}`}>
                                          {newVal || '-'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                    {activeRecord.afterSnapshot.length > 5 && (
                      <p className="text-center text-xs text-slate-400 py-2">
                        还有 {activeRecord.afterSnapshot.length - 5} 条变更记录未显示
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showConfirmModal && activeRecord && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-danger-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">确认执行回滚操作</h3>
                  <p className="text-xs text-slate-500">此操作将影响 {activeRecord.changeCount} 条数据</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-danger-50 border border-danger-200">
                <p className="text-sm font-semibold text-danger-800 mb-2">⚠️ 重要提醒</p>
                <ul className="space-y-1.5 text-xs text-danger-700">
                  <li>• 回滚操作将恢复员工的原部门、岗位和汇报关系</li>
                  <li>• 已生成的审批单和考勤记录不受影响</li>
                  <li>• 建议在非工作时段执行此操作</li>
                  <li>• 操作完成后系统将自动生成回滚日志</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">批次名称</span>
                  <span className="font-semibold text-slate-800">{activeRecord.batchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">变更数量</span>
                  <span className="font-semibold text-danger-700">{activeRecord.changeCount} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">风险等级</span>
                  <span className={`font-bold ${
                    activeRecord.riskLevel === 'high' ? 'text-danger-700' :
                    activeRecord.riskLevel === 'medium' ? 'text-warning-700' : 'text-success-700'
                  }`}>
                    {activeRecord.riskLevel === 'high' ? '高风险' : activeRecord.riskLevel === 'medium' ? '中风险' : '低风险'}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary">取消</button>
              <button onClick={handleConfirmRollback} className="btn-danger" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                确认撤回变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, animateIdx }: {
  label: string; value: number; icon: any; color: string; animateIdx: number;
}) {
  const colorMap: Record<string, string> = {
    primary: 'border-primary-200 text-primary-700',
    success: 'border-success-200 text-success-700',
    danger: 'border-danger-200 text-danger-700',
    info: 'border-info-200 text-info-700',
  };
  const bgMap: Record<string, string> = {
    primary: 'bg-primary-50',
    success: 'bg-success-50',
    danger: 'bg-danger-50',
    info: 'bg-info-50',
  };
  return (
    <div className={`stat-card animate-slide-up animate-stagger-${animateIdx}`} style={{
      borderLeft: `4px solid ${
        color === 'primary' ? '#1e40af' :
        color === 'success' ? '#059669' :
        color === 'danger' ? '#dc2626' : '#0284c7'
      }`
    }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgMap[color]} ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
