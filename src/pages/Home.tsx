import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import PrecheckModal from '@/components/PrecheckModal';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Edit3,
  Eye,
  ChevronRight,
  FileSearch,
  CheckCheck,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  History,
  Clock,
  Hash,
  BarChart3
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';
import type { EmployeeChange, ValidationErrorType } from '../../shared/types';
import { ERROR_TYPE_LABELS } from '../../shared/types';

const STEPS = [
  { id: 0, label: '清单导入与校验', icon: FileSearch },
  { id: 1, label: '影响预览分析', icon: Eye },
  { id: 2, label: '批量提交执行', icon: ArrowRight },
  { id: 3, label: '结果报告生成', icon: CheckCheck },
];

const SAMPLE_DATA: Omit<EmployeeChange, 'id' | 'status'>[] = [
  { employeeId: 'E010', employeeName: '郑小明', sourceDepartment: 'D002', targetDepartment: 'D003', targetPosition: 'P015', effectiveDate: '2026-06-15', newManagerId: 'E003' },
  { employeeId: 'E011', employeeName: '黄丽', sourceDepartment: 'D002', targetDepartment: 'D001', targetPosition: 'P001', effectiveDate: '2026-06-15', newManagerId: 'E001' },
  { employeeId: 'E013', employeeName: '何婷', sourceDepartment: 'D005', targetDepartment: 'D002', targetPosition: 'P003', effectiveDate: '2026-06-20', newManagerId: 'E002' },
  { employeeId: 'E015', employeeName: '谢雯', sourceDepartment: 'D002', targetDepartment: 'D005', targetPosition: 'P009', effectiveDate: '2026-06-20', newManagerId: 'E005' },
  { employeeId: 'E017', employeeName: '刘梦琪', sourceDepartment: 'D002', targetDepartment: 'D004', targetPosition: 'P010', effectiveDate: '2026-07-01', newManagerId: 'E006' },
  { employeeId: 'E018', employeeName: '杨帆', sourceDepartment: 'D005', targetDepartment: 'D007', targetPosition: 'P014', effectiveDate: '2026-07-01', newManagerId: 'E007' },
  { employeeId: 'E020', employeeName: '郭晓彤', sourceDepartment: 'D007', targetDepartment: 'D008', targetPosition: 'P012', effectiveDate: '2026-07-05', newManagerId: 'E008' },
  { employeeId: 'E007', employeeName: '孙磊', sourceDepartment: 'D007', targetDepartment: 'D004', targetPosition: 'P007', effectiveDate: '2026-07-10', newManagerId: 'E004' },
];

const ERROR_TYPE_ICONS: Record<ValidationErrorType, typeof AlertTriangle> = {
  missing: AlertCircle,
  duplicate: XCircle,
  invalid_department: XCircle,
  invalid_position: XCircle,
  invalid_manager: AlertTriangle,
  circular_reporting: AlertTriangle,
  invalid_date: AlertTriangle,
};

const ERROR_TYPE_COLORS: Record<ValidationErrorType, string> = {
  missing: 'bg-danger-50 text-danger-700 border-danger-200',
  duplicate: 'bg-warning-50 text-warning-700 border-warning-200',
  invalid_department: 'bg-danger-50 text-danger-700 border-danger-200',
  invalid_position: 'bg-danger-50 text-danger-700 border-danger-200',
  invalid_manager: 'bg-warning-50 text-warning-700 border-warning-200',
  circular_reporting: 'bg-warning-50 text-warning-700 border-warning-200',
  invalid_date: 'bg-warning-50 text-warning-700 border-warning-200',
};

const FIELD_LABELS: Record<string, string> = {
  employeeId: '员工编号',
  employeeName: '员工姓名',
  sourceDepartment: '原部门',
  targetDepartment: '新部门',
  targetPosition: '新岗位',
  effectiveDate: '生效日期',
  newManagerId: '新主管',
  newManagerName: '新主管姓名',
};

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedErrorType, setExpandedErrorType] = useState<ValidationErrorType | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChange, setEditingChange] = useState<EmployeeChange | null>(null);
  const [formData, setFormData] = useState<Partial<EmployeeChange>>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const {
    changes, totalCount, validCount, invalidCount, errorsByType,
    isLoading, error, currentStep,
    setChanges, addChange, updateChange, removeChange, clearChanges,
    validateChanges, departments, employees, positions,
    runPrecheck, batchSummaryList, fetchBatchList, fetchReport,
  } = useHRStore();

  useEffect(() => {
    fetchBatchList();
  }, [fetchBatchList]);

  const deptMap = new Map(departments.map(d => [d.id, d.name]));
  const empMap = new Map(employees.map(e => [e.id, e.name]));
  const posMap = new Map(positions.map(p => [p.id, p.name]));

  const genId = () => `CHG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      runPrecheck(csvText, file.name);
    };
    reader.readAsText(file, 'UTF-8');
  }, [runPrecheck]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const loadSampleData = () => {
    const sample: EmployeeChange[] = SAMPLE_DATA.map(d => ({
      ...d,
      id: genId(),
      status: 'pending',
    }));
    setChanges(sample);
  };

  const downloadTemplate = () => {
    const headers = ['员工编号', '员工姓名', '原部门', '新部门', '新岗位', '生效日期', '新主管', '新主管姓名'];
    const rows = [
      headers.join(','),
      'E010,郑小明,D002,D003,P015,2026-06-15,E003,王强',
      'E011,黄丽,D002,D001,P001,2026-06-15,E001,张伟',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HR异动清单模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDisplayValue = (value: string, type: 'dept' | 'emp' | 'pos') => {
    if (!value) return '-';
    const map = type === 'dept' ? deptMap : type === 'emp' ? empMap : posMap;
    const name = map.get(value);
    return name ? `${name} (${value})` : value;
  };

  const handleSubmitForm = () => {
    if (editingChange) {
      updateChange(editingChange.id, { ...formData, status: 'pending' } as EmployeeChange);
    } else {
      addChange({
        id: genId(),
        status: 'pending',
        employeeId: formData.employeeId || '',
        employeeName: formData.employeeName || '',
        sourceDepartment: formData.sourceDepartment || '',
        targetDepartment: formData.targetDepartment || '',
        targetPosition: formData.targetPosition || '',
        effectiveDate: formData.effectiveDate || '',
        newManagerId: formData.newManagerId || '',
        newManagerName: formData.newManagerName || '',
      });
    }
    setShowAddModal(false);
    setEditingChange(null);
    setFormData({});
  };

  const openEditModal = (change: EmployeeChange) => {
    setEditingChange(change);
    setFormData({ ...change });
    setShowAddModal(true);
  };

  const handleViewReport = async (batchId: string) => {
    await fetchReport(batchId);
    navigate('/report');
  };

  const getChangesByErrorType = (type: ValidationErrorType): EmployeeChange[] => {
    return changes.filter(c => c.errors?.some(e => e.type === type));
  };

  const progressPct = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-5 animate-slide-up">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const cls = isActive ? 'step-active' : isCompleted ? 'step-completed' : 'step-pending';
              return (
                <div key={step.id} className={`${cls} min-w-[180px] animate-slide-up animate-stagger-${idx + 1}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive ? 'bg-white/20' : isCompleted ? 'bg-success-100' : 'bg-slate-200'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm">{step.label}</span>
                  {idx < STEPS.length - 1 && <ChevronRight className="w-4 h-4 ml-2 opacity-50" />}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => validateChanges()}
            disabled={changes.length === 0 || isLoading}
            className="btn-primary animate-slide-up animate-stagger-5"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            执行校验
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-danger-200 bg-danger-50 flex items-center gap-3 animate-slide-up">
          <AlertCircle className="w-5 h-5 text-danger-600 shrink-0" />
          <p className="text-sm text-danger-800">{error}</p>
          <button onClick={() => useHRStore.setState({ error: null })} className="ml-auto">
            <X className="w-4 h-4 text-danger-600" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        <div className="stat-card animate-slide-up animate-stagger-1" style={{ borderLeft: '4px solid #1e40af' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">清单总数</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{totalCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-primary-700" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        <div className="stat-card animate-slide-up animate-stagger-2" style={{ borderLeft: '4px solid #059669' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">校验通过</p>
              <p className="text-3xl font-bold text-success-700 mt-2">{validCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-fill bg-gradient-to-r from-success-500 to-success-600" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="stat-card animate-slide-up animate-stagger-3" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">存在问题</p>
              <p className="text-3xl font-bold text-danger-700 mt-2">{invalidCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-danger-50 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="h-full bg-gradient-to-r from-danger-400 to-danger-600 rounded-full transition-all duration-500" style={{ width: `${100 - progressPct}%` }} />
            </div>
          </div>
        </div>

        <div className="stat-card animate-slide-up animate-stagger-4" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">校验通过率</p>
              <p className="text-3xl font-bold text-info-700 mt-2">{progressPct}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-info-50 flex items-center justify-center">
              <Info className="w-6 h-6 text-info-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="h-full bg-gradient-to-r from-info-500 to-info-600 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-5">
          <div className={`card p-6 ${isDragOver ? 'dropzone-active' : ''} animate-slide-up animate-stagger-1`}
               onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
               onDragLeave={() => setIsDragOver(false)}
               onDrop={handleDrop}>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary-700" />
              导入异动清单
            </h3>
            <div className={`${isDragOver ? 'dropzone-active' : 'dropzone'}`}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary-700" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">拖拽文件到此处</p>
              <p className="text-xs text-slate-500 mb-4">或点击按钮选择文件</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="btn-primary text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  选择文件
                </button>
                <button onClick={downloadTemplate} className="btn-secondary text-xs">
                  <Download className="w-3.5 h-3.5" />
                  下载模板
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-4">支持 CSV 格式 | 单次最多 500 条</p>
            </div>

            <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
              <div className="flex gap-2">
                <button onClick={loadSampleData} className="flex-1 btn-secondary text-sm">
                  <RefreshCw className="w-4 h-4" />
                  加载示例数据
                </button>
                <button onClick={() => setShowHistoryModal(true)} className="btn-ghost text-sm border border-slate-200 px-3" title="查看历史批次">
                  <History className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">历史批次</span>
                </button>
              </div>
              <button onClick={() => { setShowAddModal(true); setEditingChange(null); setFormData({}); }} className="w-full btn-ghost text-sm border border-dashed border-slate-300">
                <Plus className="w-4 h-4" />
                手动添加一条
              </button>
              {changes.length > 0 && (
                <button onClick={clearChanges} className="w-full btn-ghost text-sm text-danger-600 hover:bg-danger-50">
                  <Trash2 className="w-4 h-4" />
                  清空清单
                </button>
              )}
            </div>
          </div>

          <div className="card p-5 animate-slide-up animate-stagger-2">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              错误类型统计
            </h3>
            <div className="space-y-2">
              {(Object.keys(ERROR_TYPE_LABELS) as ValidationErrorType[]).map(type => {
                const count = errorsByType[type] || 0;
                const Icon = ERROR_TYPE_ICONS[type];
                const isExpanded = expandedErrorType === type;
                return (
                  <div key={type}>
                    <button
                      onClick={() => setExpandedErrorType(isExpanded ? null : type)}
                      disabled={count === 0}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                        count > 0 ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                      } ${isExpanded ? 'bg-slate-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ERROR_TYPE_COLORS[type]}`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800">{ERROR_TYPE_LABELS[type]}</p>
                          <p className="text-xs text-slate-500">影响 {count} 条记录</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          count > 0 ? 'bg-danger-100 text-danger-700' : 'bg-slate-100 text-slate-500'
                        }`}>{count}</span>
                        {count > 0 && <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />}
                      </div>
                    </button>
                    {isExpanded && count > 0 && (
                      <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-200 space-y-1 animate-slide-up">
                        {getChangesByErrorType(type).slice(0, 5).map(change => (
                          <div key={change.id} className="p-2 rounded bg-slate-50">
                            <p className="text-xs font-medium text-slate-700">
                              {change.employeeName || change.employeeId}
                            </p>
                            {change.errors?.filter(e => e.type === type).slice(0, 2).map((err, i) => (
                              <p key={i} className="text-xs text-danger-600 mt-0.5">• {err.message}</p>
                            ))}
                          </div>
                        ))}
                        {getChangesByErrorType(type).length > 5 && (
                          <p className="text-xs text-slate-400 pl-2">还有 {getChangesByErrorType(type).length - 5} 条...</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5 animate-slide-up animate-stagger-3">
            <h3 className="text-base font-bold text-slate-800 mb-3">操作提示</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex gap-2"><Info className="w-4 h-4 text-info-500 shrink-0" />请确保员工编号与系统一致</li>
              <li className="flex gap-2"><Info className="w-4 h-4 text-info-500 shrink-0" />部门和岗位可填写编号或名称</li>
              <li className="flex gap-2"><Info className="w-4 h-4 text-info-500 shrink-0" />生效日期不能早于今天</li>
              <li className="flex gap-2"><Info className="w-4 h-4 text-info-500 shrink-0" />循环汇报关系系统自动检测</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => navigate('/impact')}
                disabled={validCount === 0}
                className="w-full btn-success"
              >
                下一步：预览影响
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-2 card animate-slide-up animate-stagger-2">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">异动清单详情</h3>
              <p className="text-xs text-slate-500 mt-0.5">共 {totalCount} 条记录 · {validCount} 条通过 · {invalidCount} 条异常</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-success-100 text-success-700"><CheckCircle2 className="w-3 h-3" />通过 {validCount}</span>
              <span className="badge bg-danger-100 text-danger-700"><XCircle className="w-3 h-3" />异常 {invalidCount}</span>
            </div>
          </div>
          <div className="overflow-auto scrollbar-thin max-h-[700px]">
            {changes.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">暂无数据</p>
                <p className="text-xs text-slate-400">导入文件或加载示例数据开始操作</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="table-header w-10">#</th>
                    <th className="table-header">员工信息</th>
                    <th className="table-header">原部门</th>
                    <th className="table-header">新部门/岗位</th>
                    <th className="table-header">新主管</th>
                    <th className="table-header">生效日期</th>
                    <th className="table-header">状态</th>
                    <th className="table-header w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change, idx) => {
                    const hasError = change.errors && change.errors.length > 0;
                    return (
                      <tr key={change.id} className={`hover:bg-slate-50/60 transition-colors ${
                        hasError ? 'bg-danger-50/30' : ''
                      }`}>
                        <td className="table-cell font-mono text-xs text-slate-400">{idx + 1}</td>
                        <td className="table-cell">
                          <div className="font-semibold text-slate-800">{change.employeeName || '-'}</div>
                          <div className="text-xs text-slate-500 font-mono">{change.employeeId}</div>
                        </td>
                        <td className="table-cell text-sm">
                          <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                            {getDisplayValue(change.sourceDepartment, 'dept')}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="font-medium text-primary-700">{getDisplayValue(change.targetDepartment, 'dept')}</div>
                          <div className="text-xs text-slate-500">{getDisplayValue(change.targetPosition, 'pos')}</div>
                        </td>
                        <td className="table-cell text-sm">
                          {change.newManagerName || empMap.get(change.newManagerId) || change.newManagerId || '-'}
                        </td>
                        <td className="table-cell text-sm font-mono">{change.effectiveDate || '-'}</td>
                        <td className="table-cell">
                          {hasError ? (
                            <div>
                              <span className="badge bg-danger-100 text-danger-700 mb-1">
                                <AlertTriangle className="w-3 h-3" /> {change.errors!.length}项错误
                              </span>
                              <div className="max-w-[200px]">
                                {change.errors!.slice(0, 2).map((e, i) => (
                                  <p key={i} className="text-xs text-danger-600 truncate" title={e.message}>• {e.message}</p>
                                ))}
                              </div>
                            </div>
                          ) : change.status === 'validated' ? (
                            <span className="badge bg-success-100 text-success-700">
                              <CheckCircle2 className="w-3 h-3" /> 校验通过
                            </span>
                          ) : (
                            <span className="badge bg-slate-100 text-slate-600">待校验</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditModal(change)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeChange(change.id)} className="p-1.5 rounded hover:bg-danger-50 text-slate-500 hover:text-danger-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />

      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingChange(null); }}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingChange ? '编辑异动' : '新增异动记录'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingChange(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-auto scrollbar-thin">
              {Object.entries({ employeeId: '员工编号', employeeName: '员工姓名', sourceDepartment: '原部门', targetDepartment: '新部门', targetPosition: '新岗位', newManagerId: '新主管编号', newManagerName: '新主管姓名', effectiveDate: '生效日期' }).map(([key, label]) => (
                <div key={key} className={key === 'effectiveDate' ? 'col-span-2' : ''}>
                  <label className="label">{label}</label>
                  {key.includes('Department') ? (
                    <select
                      className="input-base"
                      value={(formData as any)[key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">请选择部门</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
                    </select>
                  ) : key === 'targetPosition' ? (
                    <select
                      className="input-base"
                      value={(formData as any)[key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">请选择岗位</option>
                      {positions.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                    </select>
                  ) : key.includes('Manager') && key.includes('Id') ? (
                    <select
                      className="input-base"
                      value={(formData as any)[key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">请选择主管</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                    </select>
                  ) : key === 'effectiveDate' ? (
                    <input
                      type="date"
                      className="input-base"
                      value={(formData as any)[key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="text"
                      className="input-base"
                      value={(formData as any)[key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`请输入${label}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => { setShowAddModal(false); setEditingChange(null); }} className="btn-secondary">取消</button>
              <button onClick={handleSubmitForm} className="btn-primary">{editingChange ? '保存修改' : '确认添加'}</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">历史批次记录</h3>
                  <p className="text-xs text-slate-500 mt-0.5">共 {batchSummaryList.length} 条记录，点击行可查看详细报告</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {batchSummaryList.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">暂无历史批次</p>
                  <p className="text-xs text-slate-400">完成一次批量执行后会在此处显示</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {batchSummaryList.map((batch) => {
                    const rate = batch.successRate != null ? Math.round(batch.successRate * 100) : 0;
                    return (
                      <button
                        key={batch.batchId}
                        onClick={() => handleViewReport(batch.batchId)}
                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Hash className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono text-xs text-slate-500">{batch.batchId}</span>
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                                batch.status === 'completed' ? 'bg-success-100 text-success-700' :
                                batch.status === 'failed' ? 'bg-danger-100 text-danger-700' :
                                'bg-warning-100 text-warning-700'
                              }`}>
                                {batch.status === 'completed' ? '已完成' : batch.status === 'failed' ? '失败' : '处理中'}
                              </span>
                            </div>
                            <h4 className="font-semibold text-slate-800 group-hover:text-primary-700 transition-colors truncate">
                              {batch.batchName || '未命名批次'}
                            </h4>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {batch.endTime || '-'}
                              </span>
                              {batch.operator && (
                                <span>操作人：{batch.operator}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1">
                              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm font-bold text-slate-700">{batch.totalCount || 0}</span>
                              <span className="text-xs text-slate-400">条</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-lg font-bold ${
                                rate >= 90 ? 'text-success-600' : rate >= 70 ? 'text-warning-600' : 'text-danger-600'
                              }`}>{rate}%</span>
                              <span className="text-[10px] text-slate-400">成功率</span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  rate >= 90 ? 'bg-success-500' : rate >= 70 ? 'bg-warning-500' : 'bg-danger-500'
                                }`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <span className="text-success-600">✓ {batch.successCount || 0}</span>
                              <span className="text-danger-600">✗ {batch.failedCount || 0}</span>
                              {batch.rolledBackCount > 0 && (
                                <span className="text-amber-600">↩ {batch.rolledBackCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end">
              <button onClick={() => setShowHistoryModal(false)} className="btn-secondary">关闭</button>
            </div>
          </div>
        </div>
      )}

      <PrecheckModal />
    </div>
  );
}
