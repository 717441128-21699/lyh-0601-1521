import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Columns3,
  CalendarRange,
  ArrowRightLeft,
  DatabaseZap,
  Wand2,
} from 'lucide-react';
import { useHRStore } from '@/stores/hrStore';
import { TARGET_FIELDS } from '../../shared/types';
import type { PrecheckColumnMapping } from '../../shared/types';

const TARGET_FIELD_OPTIONS = Object.entries(TARGET_FIELDS).map(([key, meta]) => ({
  value: key,
  label: `${meta.label}${meta.required ? '（必填）' : ''}`,
  required: meta.required,
}));

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  employeeId: <DatabaseZap className="w-4 h-4" />,
  employeeName: <DatabaseZap className="w-4 h-4" />,
  sourceDepartment: <Columns3 className="w-4 h-4" />,
  targetDepartment: <Columns3 className="w-4 h-4" />,
  targetPosition: <Wand2 className="w-4 h-4" />,
  effectiveDate: <CalendarRange className="w-4 h-4" />,
  newManagerId: <ArrowRightLeft className="w-4 h-4" />,
};

export default function PrecheckModal() {
  const {
    precheckOpen,
    precheckResult,
    precheckMapping,
    closePrecheck,
    updatePrecheckMapping,
    applyMappingAndImport,
  } = useHRStore();

  const [activeTab, setActiveTab] = useState<'mapping' | 'preview' | 'issues'>('mapping');

  const issues = useMemo(() => {
    if (!precheckResult?.rows) return [];
    return precheckResult.rows.flatMap((r) =>
      r.issues.map((i) => ({ ...i, rowIndex: r.rowIndex }))
    );
  }, [precheckResult]);

  const requiredFilled = useMemo(() => {
    const required = Object.entries(TARGET_FIELDS)
      .filter(([, m]) => m.required)
      .map(([k]) => k);
    return required.every((r) =>
      precheckMapping.some((m) => m.targetField === r && m.sourceColumn)
    );
  }, [precheckMapping]);

  const updateMapping = (sourceColumn: string, newTarget: string) => {
    const next = precheckMapping.map((m) => {
      if (m.sourceColumn === sourceColumn) return { ...m, targetField: newTarget, detected: true };
      if (m.targetField === newTarget && m.sourceColumn !== sourceColumn) {
        return { ...m, targetField: '', detected: false };
      }
      return m;
    });
    const stillNeeded = TARGET_FIELD_OPTIONS.filter((o) => !next.some((m) => m.targetField === o.value));
    stillNeeded.forEach((opt) => {
      const existing = next.find((m) => m.targetField === '' && !m.sourceColumn);
      if (existing) {
        const idx = next.indexOf(existing);
        next[idx] = {
          sourceColumn: '',
          targetField: opt.value,
          required: opt.required,
          sampleValue: '',
          detected: false,
        };
      } else if (!next.some((n) => n.targetField === opt.value)) {
        next.push({
          sourceColumn: '',
          targetField: opt.value,
          required: opt.required,
          sampleValue: '',
          detected: false,
        });
      }
    });
    updatePrecheckMapping(next.filter((m, i, arr) => {
      if (m.sourceColumn) return true;
      return !arr.some((other, j) => j > i && other.targetField === m.targetField && other.sourceColumn);
    }));
  };

  const handleConfirm = async () => {
    const mapping = precheckMapping
      .filter((m) => m.targetField && m.sourceColumn)
      .map((m) => ({ sourceColumn: m.sourceColumn, targetField: m.targetField }));
    await applyMappingAndImport(mapping);
  };

  if (!precheckOpen || !precheckResult) return null;

  return (
    <div className="modal-overlay" onClick={closePrecheck}>
      <div
        className="modal-content max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">导入数据预检</h3>
                <p className="text-sm text-slate-500">
                  共检测到 {precheckResult.totalRows} 条记录 · {precheckResult.columns.length} 列 ·
                  分隔符「{precheckResult.detectedDelimiter}」
                </p>
              </div>
            </div>
          </div>
          <button onClick={closePrecheck} className="btn-ghost p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('mapping')}
            className={activeTab === 'mapping' ? 'tab-active' : 'tab-inactive'}
          >
            <Columns3 className="w-4 h-4" />
            字段映射
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700">
              {precheckMapping.filter((m) => m.targetField && m.sourceColumn).length}/
              {TARGET_FIELD_OPTIONS.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={activeTab === 'preview' ? 'tab-active' : 'tab-inactive'}
          >
            <DatabaseZap className="w-4 h-4" />
            数据预览
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={activeTab === 'issues' ? 'tab-active' : 'tab-inactive'}
          >
            <AlertTriangle className="w-4 h-4" />
            预检问题
            {precheckResult.issuesCount.total > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                {precheckResult.issuesCount.total}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="card p-4 bg-blue-50/40 border-blue-200/50">
                <p className="text-sm text-slate-600">
                  系统已自动匹配列名。请核对下方字段对应关系，必要时调整后再继续导入。
                  <span className="text-red-500 font-medium">带"必填"的字段必须完成映射。</span>
                </p>
              </div>

              <div className="space-y-2">
                {precheckMapping.map((m, idx) => (
                  <MappingRow
                    key={`${m.sourceColumn}-${idx}`}
                    mapping={m}
                    onChange={updateMapping}
                  />
                ))}
              </div>

              {precheckResult.formatSuggestions.dateFormats.length > 0 && (
                <div className="card p-4 mt-6">
                  <div className="flex items-center gap-2 mb-3 text-slate-700">
                    <CalendarRange className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">日期格式检测</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {precheckResult.formatSuggestions.dateFormats.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <code className="px-2 py-1 bg-white rounded border border-slate-200 font-mono text-xs">
                          {f.sample}
                        </code>
                        <span className="text-slate-400">→</span>
                        <code className="px-2 py-1 bg-blue-50 text-primary-700 rounded border border-blue-200 font-mono text-xs">
                          {f.normalized}
                        </code>
                        <span className="text-xs text-slate-500">（格式：{f.detected}）</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="overflow-x-auto scrollbar-thin border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="table-header sticky left-0 bg-slate-50 z-10 w-16">行号</th>
                    {precheckResult.columns.map((col) => {
                      const mapped = precheckMapping.find((m) => m.sourceColumn === col);
                      return (
                        <th key={col} className="table-header">
                          <div className="flex flex-col gap-0.5">
                            <span>{col}</span>
                            {mapped?.targetField && (
                              <span className="text-[10px] font-normal text-primary-600 flex items-center gap-1">
                                → {TARGET_FIELDS[mapped.targetField]?.label || mapped.targetField}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {precheckResult.rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={row.issues.length > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50'}
                    >
                      <td className="table-cell sticky left-0 bg-inherit font-mono text-xs text-slate-500">
                        {row.rowIndex}
                        {row.issues.length > 0 && (
                          <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />
                        )}
                      </td>
                      {precheckResult.columns.map((col) => {
                        const hasIssue = row.issues.some((i) => {
                          const mapped = precheckMapping.find((m) => m.sourceColumn === col);
                          return mapped && TARGET_FIELDS[mapped.targetField]?.label === i.field;
                        });
                        return (
                          <td
                            key={col}
                            className={`table-cell ${hasIssue ? 'text-red-600 font-medium' : ''}`}
                          >
                            {row.values[col] || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {precheckResult.totalRows > precheckResult.rows.length && (
                <div className="p-3 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-200">
                  仅预览前 {precheckResult.rows.length} 行，共 {precheckResult.totalRows} 行
                </div>
              )}
            </div>
          )}

          {activeTab === 'issues' && (
            <div>
              {issues.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700">未检测到明显问题</p>
                  <p className="text-sm text-slate-500 mt-1">可继续确认映射并完成导入</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        issue.type === 'format'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      {issue.type === 'format' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-xs px-2 py-0.5 bg-white rounded border border-slate-200">
                            第 {issue.rowIndex} 行
                          </span>
                          <span className="font-medium text-slate-800">{issue.field}</span>
                        </div>
                        <p className="text-xs mt-1 text-slate-600">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-sm">
            {requiredFilled ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={requiredFilled ? 'text-slate-600' : 'text-red-600'}>
              {requiredFilled ? '所有必填字段已完成映射' : '请完成必填字段的映射'}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={closePrecheck}>
              取消
            </button>
            <button
              className="btn-primary"
              disabled={!requiredFilled}
              onClick={handleConfirm}
            >
              <CheckCircle2 className="w-4 h-4" />
              确认导入（{precheckResult.totalRows} 条）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MappingRow({
  mapping,
  onChange,
}: {
  mapping: PrecheckColumnMapping;
  onChange: (source: string, target: string) => void;
}) {
  if (!mapping.sourceColumn) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/60 border border-dashed border-slate-300">
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 max-w-xs">
            <select
              className="input-base text-sm"
              value=""
              onChange={(e) => onChange(`__EMPTY__${Math.random()}`, e.target.value)}
            >
              <option value="">-- 未匹配原始列 --</option>
              {TARGET_FIELD_OPTIONS.filter((o) => !mapping.detected && o.value === mapping.targetField || !precheckMappingHas(mapping.targetField)).map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.required}>
                  映射到：{opt.label}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-400 flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded-md">
            {TARGET_FIELDS[mapping.targetField]?.label || mapping.targetField}
            {TARGET_FIELDS[mapping.targetField]?.required && (
              <span className="text-red-500">*</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  const targetLabel = mapping.targetField
    ? TARGET_FIELDS[mapping.targetField]?.label || mapping.targetField
    : '未映射';
  const isRequired = mapping.required || TARGET_FIELDS[mapping.targetField]?.required;
  const isOk = !!mapping.targetField;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isOk
          ? 'bg-green-50/40 border-green-200'
          : isRequired
            ? 'bg-red-50/40 border-red-200'
            : 'bg-slate-50 border-slate-200'
      }`}
    >
      {FORMAT_ICONS[mapping.targetField] || <Columns3 className="w-4 h-4 text-slate-400" />}

      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div>
          <div className="font-mono text-xs text-slate-500 mb-0.5">原始列名</div>
          <div className="font-medium text-slate-800 truncate">{mapping.sourceColumn}</div>
          {mapping.sampleValue && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              示例：<span className="font-mono">{mapping.sampleValue}</span>
            </div>
          )}
        </div>

        <ArrowRightLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />

        <div>
          <div className="text-xs text-slate-500 mb-0.5">
            目标字段 {isRequired && <span className="text-red-500">*</span>}
          </div>
          <select
            className="input-base text-sm"
            value={mapping.targetField}
            onChange={(e) => onChange(mapping.sourceColumn, e.target.value)}
          >
            <option value="">未映射（忽略此列）</option>
            {TARGET_FIELD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-shrink-0">
        {isOk ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : isRequired ? (
          <XCircle className="w-5 h-5 text-red-500" />
        ) : null}
      </div>
    </div>
  );
}

function precheckMappingHas(target: string) {
  return true;
}
