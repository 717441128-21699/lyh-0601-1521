import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarClock,
  Building2,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Eye,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  ShieldAlert,
  ArrowRightLeft,
  Clock,
  UserCheck
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';

type TabType = 'approvers' | 'attendance' | 'costcenter';

export default function ImpactAnalysis() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('approvers');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const {
    validChanges, changes, impact, needsReviewCount, conflictCount, totalBudgetImpact,
    validCount, analyzeImpact, isLoading,
  } = useHRStore();

  const validItems = validChanges.length > 0 ? validChanges : changes.filter(c => !c.errors || c.errors.length === 0);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    await analyzeImpact();
    setTimeout(() => setIsAnalyzing(false), 500);
  };

  useEffect(() => {
    if (validItems.length > 0 && !impact) {
      runAnalysis();
    }
  }, []);

  const tabs: { id: TabType; label: string; icon: any; count: number; warning: boolean }[] = [
    { id: 'approvers', label: '审批人变更', icon: UserCheck, count: impact?.approvers.length || 0, warning: needsReviewCount > 0 },
    { id: 'attendance', label: '考勤组变更', icon: Clock, count: impact?.attendanceGroups.length || 0, warning: conflictCount > 0 },
    { id: 'costcenter', label: '成本中心变更', icon: Building2, count: impact?.costCenters.length || 0, warning: totalBudgetImpact > 0 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            返回工作台
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">影响范围预览</h1>
            <p className="text-sm text-slate-500">分析 {validItems.length} 条异动对审批人、考勤组和成本中心的影响</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={validItems.length === 0 || isLoading}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            重新分析
          </button>
          <button
            onClick={() => navigate('/execute')}
            disabled={!impact}
            className="btn-primary"
          >
            确认无误，进入执行
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {validItems.length === 0 ? (
        <div className="card p-16 text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <FileCheck2 className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">暂无可分析的数据</p>
          <p className="text-sm text-slate-500 mb-6">请先在主工作台导入并校验异动清单</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            前往工作台
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-5">
            <div className="stat-card animate-slide-up animate-stagger-1" style={{ borderLeft: '4px solid #1e40af' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">审批链变化</p>
                  <p className="text-3xl font-bold text-primary-700 mt-2">{impact?.approvers.length || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-primary-700" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {needsReviewCount > 0 && (
                  <span className="badge bg-warning-100 text-warning-700">
                    <ShieldAlert className="w-3 h-3" />
                    {needsReviewCount} 条需人工确认
                  </span>
                )}
                <span className="text-xs text-slate-500">涉及汇报关系调整</span>
              </div>
            </div>

            <div className="stat-card animate-slide-up animate-stagger-2" style={{ borderLeft: '4px solid #d97706' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">考勤组变化</p>
                  <p className="text-3xl font-bold text-warning-700 mt-2">{impact?.attendanceGroups.length || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning-50 flex items-center justify-center">
                  <CalendarClock className="w-6 h-6 text-warning-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {conflictCount > 0 && (
                  <span className="badge bg-danger-100 text-danger-700">
                    <AlertTriangle className="w-3 h-3" />
                    {conflictCount} 个存在冲突
                  </span>
                )}
                <span className="text-xs text-slate-500">可能影响打卡规则</span>
              </div>
            </div>

            <div className="stat-card animate-slide-up animate-stagger-3" style={{ borderLeft: '4px solid #059669' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">预算影响金额</p>
                  <p className="text-3xl font-bold text-success-700 mt-2">
                    ¥ {totalBudgetImpact.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-success-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="badge bg-info-100 text-info-700">
                  <Building2 className="w-3 h-3" />
                  {impact?.costCenters.length || 0} 个成本中心变化
                </span>
                <span className="text-xs text-slate-500">基于人员成本估算</span>
              </div>
            </div>
          </div>

          <div className="card animate-slide-up animate-stagger-4">
            <div className="border-b border-slate-100 px-6">
              <div className="flex items-center">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={activeTab === tab.id ? 'tab-active' : 'tab-inactive'}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ml-1 ${
                        activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                      {tab.warning && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              {!impact ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center animate-pulse-soft">
                    <Eye className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">正在分析影响范围...</p>
                  <p className="text-xs text-slate-400">请稍候，正在计算审批链、考勤组和成本中心的变更</p>
                </div>
              ) : activeTab === 'approvers' ? (
                <ApproversTab impact={impact} />
              ) : activeTab === 'attendance' ? (
                <AttendanceTab impact={impact} />
              ) : (
                <CostCenterTab impact={impact} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ApproversTab({ impact }: { impact: NonNullable<ReturnType<typeof useHRStore.getState>['impact']> }) {
  if (impact.approvers.length === 0) {
    return <EmptyState icon={Users} text="暂无审批人变更" subtext="所选异动不涉及汇报关系调整" />;
  }

  return (
    <div className="space-y-4">
      {impact.approvers.map((item, idx) => (
        <div
          key={item.employeeId}
          className={`p-5 rounded-xl border transition-all duration-300 hover:shadow-sm animate-slide-up animate-stagger-${(idx % 6) + 1} ${
            item.needsReview
              ? 'border-warning-200 bg-warning-50/50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                {item.employeeName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-800">{item.employeeName}</div>
                <div className="text-xs text-slate-500 font-mono">{item.employeeId}</div>
              </div>
            </div>
            {item.needsReview && (
              <span className="badge bg-warning-100 text-warning-700">
                <ShieldAlert className="w-3 h-3" />
                需人工确认
              </span>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <div className="p-4 rounded-lg bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">变更前审批链</p>
              <div className="flex flex-wrap items-center gap-2">
                {item.originalApprovers.length === 0 ? (
                  <span className="text-sm text-slate-400">无上级</span>
                ) : (
                  item.originalApprovers.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">
                        {name}
                      </span>
                      {i < item.originalApprovers.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-center h-full pt-8">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-200">
                <ArrowRightLeft className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary-50/60 border border-primary-100">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-3">变更后审批链</p>
              <div className="flex flex-wrap items-center gap-2">
                {item.newApprovers.length === 0 ? (
                  <span className="text-sm text-slate-400">无上级</span>
                ) : (
                  item.newApprovers.map((name, i) => {
                    const isChanged = !item.originalApprovers.includes(name);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                          isChanged
                            ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                            : 'bg-white border border-primary-200 text-primary-700'
                        }`}>
                          {name}
                          {isChanged && <CheckCircle2 className="w-3 h-3 inline ml-1" />}
                        </span>
                        {i < item.newApprovers.length - 1 && <ChevronRight className="w-4 h-4 text-primary-400" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttendanceTab({ impact }: { impact: NonNullable<ReturnType<typeof useHRStore.getState>['impact']> }) {
  if (impact.attendanceGroups.length === 0) {
    return <EmptyState icon={CalendarClock} text="暂无考勤组变更" subtext="所选异动不涉及考勤组变化" />;
  }

  const groupLabels: Record<string, string> = {
    'AT-TECH': '技术研发组 (弹性制)',
    'AT-STD': '标准出勤组 (固定制)',
    'AT-SALES': '市场营销组 (不定时)',
  };

  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-header">员工</th>
            <th className="table-header">原考勤组</th>
            <th className="table-header w-20"></th>
            <th className="table-header">新考勤组</th>
            <th className="table-header">状态</th>
          </tr>
        </thead>
        <tbody>
          {impact.attendanceGroups.map((item, idx) => (
            <tr key={item.employeeId} className="animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <td className="table-cell">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold text-sm">
                    {item.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{item.employeeName}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.employeeId}</div>
                  </div>
                </div>
              </td>
              <td className="table-cell">
                <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">
                  {groupLabels[item.originalGroup] || item.originalGroup}
                </span>
              </td>
              <td className="table-cell text-center">
                <ArrowRight className="w-5 h-5 text-primary-500 mx-auto" />
              </td>
              <td className="table-cell">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  item.hasConflict
                    ? 'bg-warning-100 text-warning-700 border border-warning-200'
                    : 'bg-primary-100 text-primary-700 border border-primary-200'
                }`}>
                  {groupLabels[item.newGroup] || item.newGroup}
                </span>
              </td>
              <td className="table-cell">
                {item.hasConflict ? (
                  <span className="badge bg-warning-100 text-warning-700">
                    <AlertTriangle className="w-3 h-3" />
                    需确认冲突
                  </span>
                ) : (
                  <span className="badge bg-success-100 text-success-700">
                    <CheckCircle2 className="w-3 h-3" />
                    正常
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostCenterTab({ impact }: { impact: NonNullable<ReturnType<typeof useHRStore.getState>['impact']> }) {
  if (impact.costCenters.length === 0) {
    return <EmptyState icon={Building2} text="暂无成本中心变更" subtext="所选异动均在同一成本中心内" />;
  }

  return (
    <div className="space-y-4">
      {impact.costCenters.map((item, idx) => (
        <div
          key={item.employeeId}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-primary-200 transition-all duration-300 animate-slide-up"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
                {item.employeeName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-800">{item.employeeName}</div>
                <div className="text-xs text-slate-500 font-mono">{item.employeeId}</div>
              </div>
            </div>

            <div className="col-span-3 p-3 rounded-lg bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">原成本中心</p>
              <p className="font-mono font-semibold text-slate-700">{item.originalCenter}</p>
            </div>

            <div className="col-span-1 flex justify-center">
              <ArrowRight className="w-6 h-6 text-primary-500" />
            </div>

            <div className="col-span-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase mb-1.5">新成本中心</p>
              <p className="font-mono font-semibold text-emerald-800">{item.newCenter}</p>
            </div>

            <div className="col-span-2 text-right">
              {item.budgetImpact > 0 ? (
                <>
                  <p className="text-xs text-slate-500">预算影响</p>
                  <p className="text-lg font-bold text-danger-600">
                    +¥{item.budgetImpact.toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">预算影响</p>
                  <p className="text-lg font-bold text-slate-400">无变化</p>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <p className="font-bold text-emerald-800">本次异动合计预算影响</p>
            <p className="text-xs text-emerald-600">基于人员年均成本估算，仅供参考</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-emerald-700">
          ¥ {impact.costCenters.reduce((s, i) => s + i.budgetImpact, 0).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, subtext }: { icon: any; text: string; subtext: string }) {
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{text}</p>
      <p className="text-xs text-slate-500">{subtext}</p>
    </div>
  );
}
