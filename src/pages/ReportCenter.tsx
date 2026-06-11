import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  BarChart3,
  FileText,
  Download,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Users,
  CalendarClock,
  Target,
  FileSpreadsheet,
  Mail,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Clock,
  TrendingUp,
  AlertTriangle,
  Eye,
  Undo2,
  ArrowRight,
  FileCheck2,
  RotateCcw
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';
import type { ExecutionResult, EmployeeChange } from '../../shared/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/types';

const PIE_COLORS = ['#059669', '#DC2626', '#94A3B8'];

export default function ReportCenter() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'rolled_back'>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const {
    allResults, fetchAllReports, currentExecutionResult, fetchReport,
    selectedRollbackRecord, isLoading, batchSummaryList, fetchBatchList,
  } = useHRStore();

  useEffect(() => {
    fetchBatchList();
    fetchAllReports();
  }, [fetchBatchList, fetchAllReports]);

  const displayResult = selectedBatch
    ? allResults.find(r => r.batchId === selectedBatch)
    : currentExecutionResult || allResults[0];

  useEffect(() => {
    if (displayResult?.batchId) {
      fetchReport(displayResult.batchId);
    }
  }, [selectedBatch]);

  const allItems = displayResult?.allItems || [];

  const filteredItems = allItems.filter(item => {
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'success' ? item.status === 'success' :
      filterStatus === 'failed' ? item.status === 'failed' :
      item.status === 'rolled_back';
    const matchSearch = !searchText ||
      (item.employeeName || '').toLowerCase().includes(searchText.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  const successItems = filteredItems.filter(i => i.status === 'success');
  const failedItems = filteredItems.filter(i => i.status === 'failed');
  const rolledBackItems = filteredItems.filter(i => i.status === 'rolled_back');

  const deptData = displayResult ? computeDeptData(displayResult) : [];
  const pieData = displayResult ? [
    { name: '成功', value: displayResult.successCount },
    { name: '失败', value: displayResult.failedCount },
    { name: '已撤回', value: displayResult.rolledBackCount },
  ] : [];

  const mockTrendData = [
    { month: '1月', 异动数: 45, 成功率: 92 },
    { month: '2月', 异动数: 62, 成功率: 89 },
    { month: '3月', 异动数: 78, 成功率: 95 },
    { month: '4月', 异动数: 55, 成功率: 93 },
    { month: '5月', 异动数: 89, 成功率: 91 },
    { month: '6月', 异动数: displayResult?.totalCount || 0, 成功率: displayResult ? Math.round((displayResult.successCount / displayResult.totalCount) * 100) : 0 },
  ];

  const executionDuration = displayResult
    ? `${Math.max(1, Math.round((new Date(displayResult.endTime).getTime() - new Date(displayResult.startTime).getTime()) / 1000))}s`
    : '-';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/execute')} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            返回执行
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">报告中心</h1>
            <p className="text-sm text-slate-500">查看执行结果、统计分析和明细数据</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary text-xs">
            <Printer className="w-3.5 h-3.5" />
            打印预览
          </button>
          <button className="btn-secondary text-xs">
            <Mail className="w-3.5 h-3.5" />
            邮件发送
          </button>
          <button className="btn-primary text-xs">
            <Download className="w-3.5 h-3.5" />
            导出Excel
          </button>
        </div>
      </div>

      {batchSummaryList.length > 0 && (
        <div className="card p-4 animate-slide-up flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">选择批次：</span>
          <select
            className="input-base w-auto min-w-[380px]"
            value={selectedBatch || displayResult?.batchId || ''}
            onChange={e => setSelectedBatch(e.target.value)}
          >
            {batchSummaryList.map(b => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchName} - 总数{b.totalCount}/成功{b.successCount}/失败{b.failedCount}/撤回{b.rolledBackCount} ({new Date(b.endTime).toLocaleDateString('zh-CN')}) - {b.operator}
              </option>
            ))}
          </select>
        </div>
      )}

      {!displayResult ? (
        <div className="card p-16 text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <FileText className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">暂无报告数据</p>
          <p className="text-sm text-slate-500 mb-6">请先在批量执行页完成异动提交</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/')} className="btn-secondary text-xs">
              前往工作台
            </button>
            <button onClick={() => navigate('/execute')} className="btn-primary text-xs">
              前往执行
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard
              icon={Target}
              label="处理总数"
              value={displayResult.totalCount}
              sub={`成功率 ${displayResult.totalCount ? Math.round(displayResult.successCount / displayResult.totalCount * 100) : 0}%`}
              color="primary"
              animateIdx={1}
            />
            <StatCard
              icon={CheckCircle2}
              label="成功数量"
              value={displayResult.successCount}
              sub={`占比 ${displayResult.totalCount ? Math.round(displayResult.successCount / displayResult.totalCount * 100) : 0}%`}
              color="success"
              animateIdx={2}
            />
            <StatCard
              icon={XCircle}
              label="失败数量"
              value={displayResult.failedCount}
              sub={`占比 ${displayResult.totalCount ? Math.round(displayResult.failedCount / displayResult.totalCount * 100) : 0}%`}
              color="danger"
              animateIdx={3}
            />
            <StatCard
              icon={RotateCcw}
              label="已撤回"
              value={displayResult.rolledBackCount}
              sub={`占比 ${displayResult.totalCount ? Math.round(displayResult.rolledBackCount / displayResult.totalCount * 100) : 0}%`}
              color="info"
              animateIdx={4}
            />
          </div>

          <div className="card animate-slide-up">
            <div className="border-b border-slate-100 px-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={activeTab === 'overview' ? 'tab-active' : 'tab-inactive'}
                >
                  <BarChart3 className="w-4 h-4" />
                  统计概览
                </button>
                <button
                  onClick={() => setActiveTab('detail')}
                  className={activeTab === 'detail' ? 'tab-active' : 'tab-inactive'}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  明细数据
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100">
                    {allItems.length}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'overview' ? (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-5 space-y-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-primary-600" />
                        成功/失败/撤回分布
                      </h4>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((_, index) => (
                                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border border-emerald-100">
                      <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        批次信息
                      </h4>
                      <div className="space-y-3 text-sm">
                        <InfoRow label="批次名称" value={displayResult.batchName} />
                        <InfoRow label="批次ID" value={displayResult.batchId} mono />
                        <InfoRow label="操作人" value={displayResult.operator} />
                        <InfoRow label="执行耗时" value={executionDuration} />
                        <InfoRow label="开始时间" value={new Date(displayResult.startTime).toLocaleString('zh-CN')} />
                        <InfoRow label="结束时间" value={new Date(displayResult.endTime).toLocaleString('zh-CN')} />
                        <InfoRow label="回滚状态" value={
                          selectedRollbackRecord ? (
                            <span className={`badge ${
                              selectedRollbackRecord.status === 'rolled_back' ? 'bg-slate-100 text-slate-700' :
                              selectedRollbackRecord.status === 'available' ? 'bg-success-100 text-success-700' :
                              'bg-warning-100 text-warning-700'
                            }`}>
                              {selectedRollbackRecord.status === 'rolled_back' ? '已撤回' :
                               selectedRollbackRecord.status === 'available' ? '可撤回' :
                               selectedRollbackRecord.status === 'rollback_in_progress' ? '撤回中' : '撤回失败'}
                            </span>
                          ) : <span className="text-slate-400">-</span>
                        } />
                      </div>
                      <button
                        onClick={() => navigate('/rollback')}
                        className="w-full mt-4 btn-secondary text-xs"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        前往回滚中心
                      </button>
                    </div>
                  </div>

                  <div className="col-span-7 space-y-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-sky-50/50 to-indigo-50/50 border border-sky-100">
                      <h4 className="text-sm font-bold text-sky-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        月度异动趋势
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={mockTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
                            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} />
                            <Tooltip />
                            <Legend />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="异动数"
                              stroke="#1e40af"
                              strokeWidth={3}
                              dot={{ fill: '#1e40af', strokeWidth: 2 }}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="成功率"
                              stroke="#059669"
                              strokeWidth={3}
                              dot={{ fill: '#059669', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-100">
                      <h4 className="text-sm font-bold text-amber-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        部门异动分布（当前批次）
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deptData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="成功" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="失败" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="搜索员工姓名或编号..."
                        className="input-base pl-10"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-400" />
                      {(['all', 'success', 'failed', 'rolled_back'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filterStatus === s
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s === 'all' ? `全部 (${filteredItems.length})` :
                           s === 'success' ? `成功 (${successItems.length})` :
                           s === 'failed' ? `失败 (${failedItems.length})` :
                           `已撤回 (${rolledBackItems.length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header w-10"></th>
                          <th className="table-header">员工信息</th>
                          <th className="table-header">原部门 → 新部门</th>
                          <th className="table-header">新岗位</th>
                          <th className="table-header">新主管</th>
                          <th className="table-header">生效日期</th>
                          <th className="table-header">状态</th>
                          <th className="table-header w-20">详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-16 text-center text-slate-400">
                              没有匹配的数据
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => (
                            <TableRow
                              key={item.id}
                              item={item}
                              index={idx}
                              expanded={expandedItem === item.id}
                              onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TableRow({ item, index, expanded, onToggle }: {
  item: EmployeeChange; index: number; expanded: boolean; onToggle: () => void;
}) {
  const isSuccess = item.status === 'success';
  const isFailed = item.status === 'failed';
  const isRolledBack = item.status === 'rolled_back';
  const statusLabel = STATUS_LABELS[item.status];
  const statusColor = STATUS_COLORS[item.status];
  return (
    <>
      <tr className="hover:bg-slate-50/60 transition-colors">
        <td className="table-cell text-xs font-mono text-slate-400">{index + 1}</td>
        <td className="table-cell">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              isSuccess ? 'bg-gradient-to-br from-success-400 to-success-600' :
              isFailed ? 'bg-gradient-to-br from-danger-400 to-danger-600' :
              isRolledBack ? 'bg-gradient-to-br from-slate-400 to-slate-600' :
              'bg-gradient-to-br from-slate-400 to-slate-600'
            }`}>
              {(item.employeeName || item.employeeId).charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-slate-800">{item.employeeName || '-'}</div>
              <div className="text-xs text-slate-500 font-mono">{item.employeeId}</div>
            </div>
          </div>
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
              {item.sourceDepartment}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-primary-500" />
            <span className="px-2 py-1 rounded bg-primary-100 text-primary-700 text-xs font-medium">
              {item.targetDepartment}
            </span>
          </div>
        </td>
        <td className="table-cell text-sm font-medium text-slate-700">{item.targetPosition || '-'}</td>
        <td className="table-cell text-sm">{item.newManagerName || item.newManagerId || '-'}</td>
        <td className="table-cell text-sm font-mono">{item.effectiveDate || '-'}</td>
        <td className="table-cell">
          <span className={`badge ${statusColor}`}>
            {isSuccess && <CheckCircle2 className="w-3 h-3" />}
            {isFailed && <XCircle className="w-3 h-3" />}
            {isRolledBack && <RotateCcw className="w-3 h-3" />}
            {!isSuccess && !isFailed && !isRolledBack && <AlertTriangle className="w-3 h-3" />}
            {statusLabel}
          </span>
        </td>
        <td className="table-cell">
          <button onClick={onToggle} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="animate-slide-up">
          <td colSpan={8} className="bg-slate-50/80 px-6 py-5">
            <div className="mb-4">
              <h5 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary-600" />
                变更详情对比
              </h5>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">变更项</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 w-2/5">变更前 (originalData)</th>
                      <th className="px-4 py-3 text-left font-semibold text-primary-700 w-2/5">变更后 (newData)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-700">部门</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.originalData?.departmentName || item.sourceDepartment || '-'}
                        {item.originalData?.departmentId && (
                          <span className="ml-2 text-xs text-slate-400 font-mono">({item.originalData.departmentId})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-primary-700 font-medium">
                        {item.newData?.departmentName || item.targetDepartment || '-'}
                        {item.newData?.departmentId && (
                          <span className="ml-2 text-xs text-primary-400 font-mono">({item.newData.departmentId})</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-700">岗位</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.originalData?.positionName || '-'}
                        {item.originalData?.positionId && (
                          <span className="ml-2 text-xs text-slate-400 font-mono">({item.originalData.positionId})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-primary-700 font-medium">
                        {item.newData?.positionName || item.targetPosition || '-'}
                        {item.newData?.positionId && (
                          <span className="ml-2 text-xs text-primary-400 font-mono">({item.newData.positionId})</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-700">主管</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.originalData?.managerName || '-'}
                        {item.originalData?.managerId && (
                          <span className="ml-2 text-xs text-slate-400 font-mono">({item.originalData.managerId})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-primary-700 font-medium">
                        {item.newData?.managerName || item.newManagerName || '-'}
                        {(item.newData?.managerId || item.newManagerId) && (
                          <span className="ml-2 text-xs text-primary-400 font-mono">({item.newData?.managerId || item.newManagerId})</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <DetailItem label="员工编号" value={item.employeeId} />
              <DetailItem label="员工姓名" value={item.employeeName || '-'} />
              <DetailItem label="新岗位" value={item.targetPosition} />
              <DetailItem label="生效日期" value={item.effectiveDate} />
              <DetailItem label="成本中心" value={item.newData?.costCenter || item.originalData?.costCenter || '-'} />
              <DetailItem label="考勤组" value={item.newData?.attendanceGroup || item.originalData?.attendanceGroup || '-'} />
              <DetailItem label="新主管编号" value={item.newManagerId} />
              <DetailItem label="新主管姓名" value={item.newManagerName || '-'} />
            </div>
            {isFailed && item.failReason && (
              <div className="mt-4 p-4 rounded-xl bg-danger-50 border border-danger-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-danger-800 uppercase tracking-wider mb-1">失败原因</p>
                  <p className="text-sm text-danger-700">{item.failReason}</p>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, animateIdx }: {
  icon: any; label: string; value: any; sub?: string; color: string; animateIdx: number;
}) {
  const cfg = {
    primary: { grad: 'from-primary-100 to-primary-200', text: 'text-primary-700', line: '#1e40af' },
    success: { grad: 'from-success-100 to-success-200', text: 'text-success-700', line: '#059669' },
    danger: { grad: 'from-danger-100 to-danger-200', text: 'text-danger-700', line: '#DC2626' },
    info: { grad: 'from-slate-100 to-slate-200', text: 'text-slate-700', line: '#94A3B8' },
  }[color]!;
  return (
    <div className={`stat-card animate-slide-up animate-stagger-${animateIdx}`} style={{ borderLeft: `4px solid ${cfg.line}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.grad} flex items-center justify-center shadow-sm`}>
          <Icon className={`w-6 h-6 ${cfg.text}`} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {typeof value === 'string' || typeof value === 'number' ? value : value}
      </span>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-white border border-slate-200">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value || '-'}</p>
    </div>
  );
}

function computeDeptData(result: ExecutionResult): { name: string; 成功: number; 失败: number }[] {
  const deptMap = new Map<string, { 成功: number; 失败: number }>();

  const shortDept = (id: string) => {
    const map: Record<string, string> = {
      D001: '研发部', D002: '前端组', D003: '后端组',
      D004: '产品部', D005: '产品组', D006: 'UI组',
      D007: '市场部', D008: '人事部', D009: '财务部', D010: '运营部',
    };
    return map[id] || id;
  };

  result.successItems.forEach(item => {
    const key = shortDept(item.targetDepartment);
    const prev = deptMap.get(key) || { 成功: 0, 失败: 0 };
    deptMap.set(key, { ...prev, 成功: prev.成功 + 1 });
  });
  result.failedItems.forEach(item => {
    const key = shortDept(item.targetDepartment);
    const prev = deptMap.get(key) || { 成功: 0, 失败: 0 };
    deptMap.set(key, { ...prev, 失败: prev.失败 + 1 });
  });

  return Array.from(deptMap, ([name, v]) => ({ name, ...v }));
}
