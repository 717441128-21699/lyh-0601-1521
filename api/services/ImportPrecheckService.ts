import Papa from 'papaparse';
import type {
  PrecheckColumnMapping,
  PrecheckResponse,
  PrecheckRow,
  EmployeeChange,
} from '../../shared/types';
import { TARGET_FIELDS } from '../../shared/types';

interface ParseResult {
  data: Record<string, any>[];
  meta: {
    fields?: string[];
    delimiter?: string;
  };
}

const parseCsv = (content: string): ParseResult => {
  let result: any = { data: [], meta: {} };
  Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    complete: (res: any) => {
      result = res;
    },
  } as any);
  return result as ParseResult;
};

const FIELD_ALIASES: Record<string, string> = {
  员工编号: 'employeeId',
  员工工号: 'employeeId',
  工号: 'employeeId',
  EmployeeID: 'employeeId',
  employeeId: 'employeeId',
  employee_id: 'employeeId',

  员工姓名: 'employeeName',
  姓名: 'employeeName',
  Name: 'employeeName',
  employeeName: 'employeeName',

  原部门: 'sourceDepartment',
  原部门编号: 'sourceDepartment',
  原部门名称: 'sourceDepartment',
  调出部门: 'sourceDepartment',
  sourceDepartment: 'sourceDepartment',

  新部门: 'targetDepartment',
  目标部门: 'targetDepartment',
  新部门编号: 'targetDepartment',
  新部门名称: 'targetDepartment',
  调入部门: 'targetDepartment',
  targetDepartment: 'targetDepartment',

  新岗位: 'targetPosition',
  目标岗位: 'targetPosition',
  新岗位编号: 'targetPosition',
  新岗位名称: 'targetPosition',
  调整后岗位: 'targetPosition',
  targetPosition: 'targetPosition',

  生效日期: 'effectiveDate',
  日期: 'effectiveDate',
  生效时间: 'effectiveDate',
  执行日期: 'effectiveDate',
  effectiveDate: 'effectiveDate',
  effect_date: 'effectiveDate',

  新主管: 'newManagerId',
  新主管编号: 'newManagerId',
  新主管姓名: 'newManagerId',
  上级: 'newManagerId',
  汇报对象: 'newManagerId',
  直接主管: 'newManagerId',
  Manager: 'newManagerId',
  newManagerId: 'newManagerId',
};

const DATE_PATTERNS = [
  { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, format: 'YYYY-MM-DD', example: '2026-06-12' },
  { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, format: 'YYYY/MM/DD', example: '2026/6/12' },
  { regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, format: 'YYYY.MM.DD', example: '2026.06.12' },
  { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: 'MM-DD-YYYY', example: '06-12-2026' },
  { regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, format: 'YYYY年MM月DD日', example: '2026年6月12日' },
];

const normalizeDate = (value: string, expectedFormat?: string): { normalized: string; detectedFormat: string } => {
  const v = value.trim();
  if (expectedFormat) {
    const pattern = DATE_PATTERNS.find(p => p.format === expectedFormat);
    if (pattern) {
      const m = v.match(pattern.regex);
      if (m) {
        let y: string, mo: string, d: string;
        if (pattern.format.startsWith('YYYY')) {
          [, y, mo, d] = m;
        } else {
          [, mo, d, y] = m;
        }
        const year = parseInt(y, 10);
        const month = parseInt(mo, 10);
        const day = parseInt(d, 10);
        const normalized = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return { normalized, detectedFormat: expectedFormat };
      }
    }
  }
  for (const p of DATE_PATTERNS) {
    if (p.regex.test(v)) {
      const m = v.match(p.regex);
      if (m) {
        let y: string, mo: string, d: string;
        if (p.format.startsWith('YYYY')) {
          [, y, mo, d] = m;
        } else {
          [, mo, d, y] = m;
        }
        const year = parseInt(y, 10);
        const month = parseInt(mo, 10);
        const day = parseInt(d, 10);
        const normalized = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return { normalized, detectedFormat: p.format };
      }
    }
  }
  return { normalized: v, detectedFormat: '未知格式' };
};

const autoDetectMapping = (
  columns: string[],
  firstRow: Record<string, string>
): PrecheckColumnMapping[] => {
  const requiredFields = Object.keys(TARGET_FIELDS);
  const result: PrecheckColumnMapping[] = columns.map((col) => {
    const trimmed = col.trim();
    const target = FIELD_ALIASES[trimmed] || FIELD_ALIASES[trimmed.toLowerCase()] || '';
    const lowerTrim = trimmed.toLowerCase();
  let detectedTarget = target;
    if (!detectedTarget) {
      const matched = Object.entries(FIELD_ALIASES).find(([alias]) =>
        alias.toLowerCase().includes(lowerTrim) || lowerTrim.includes(alias.toLowerCase())
      );
      if (matched) {
        detectedTarget = matched[1];
      }
    }
    const req = detectedTarget ? TARGET_FIELDS[detectedTarget]?.required || false : false;
    return {
      sourceColumn: col,
      targetField: detectedTarget || '',
      detected: !!detectedTarget && requiredFields.includes(detectedTarget),
      required: req,
      sampleValue: (firstRow && firstRow[col]) || '',
    };
  });

  requiredFields.forEach((f) => {
    const found = result.find((m) => m.targetField === f);
    if (!found) {
      result.push({
        sourceColumn: '',
        targetField: f,
        detected: false,
        required: TARGET_FIELDS[f].required,
        sampleValue: '',
      });
    }
  });

  return result;
};

export class ImportPrecheckService {
  public precheckCSV(csvContent: string, filename?: string): PrecheckResponse {
    const result = parseCsv(csvContent);

    const columns = (result.meta.fields || []).filter((c) => c && c.trim());
    const allRows = result.data as Record<string, any>[];
    const firstRow = allRows[0] || {};
    const previewRows = allRows.slice(0, 10);

    const mapping = autoDetectMapping(columns, firstRow);

    let missingIssues = 0;
    let formatIssues = 0;

    const rows: PrecheckRow[] = previewRows.map((row, idx) => {
      const issues: PrecheckRow['issues'] = [];
      mapping.forEach((m) => {
        if (m.required && (!row[m.sourceColumn] === undefined || String(row[m.sourceColumn]).trim() === '')) {
          missingIssues++;
          issues.push({
            field: TARGET_FIELDS[m.targetField]?.label || m.targetField,
            type: 'missing',
            message: '该字段必填但值为空',
          });
        }
        if (m.targetField === 'effectiveDate' && row[m.sourceColumn]) {
          const { normalized, detectedFormat } = normalizeDate(String(row[m.sourceColumn]));
          if (detectedFormat === '未知格式') {
            formatIssues++;
            issues.push({
              field: '生效日期',
              type: 'format',
              message: `无法识别的日期格式，请调整为 YYYY-MM-DD（如 2026-06-12）`,
            });
          }
        }
      });
      return {
        rowIndex: idx + 1,
        values: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '')])),
        issues,
      };
    });

    const dateFields = mapping.filter((m) => m.targetField === 'effectiveDate').map((m) => m.sourceColumn);
    const dateFormats: { detected: string; sample: string; normalized: string }[] = [];
    previewRows.forEach((row) => {
      dateFields.forEach((df) => {
        if (row[df]) {
          const res = normalizeDate(String(row[df]));
          if (!dateFormats.find((f) => f.detected === res.detectedFormat)) {
            dateFormats.push({
              detected: res.detectedFormat,
              sample: String(row[df]),
              normalized: res.normalized,
            });
          }
        }
      });
    });

    return {
      columns,
      rows,
      totalRows: allRows.length,
      mapping,
      detectedDelimiter: result.meta.delimiter || ',',
      formatSuggestions: {
        dateFields,
        dateFormats,
      },
      issuesCount: {
        missing: missingIssues,
        format: formatIssues,
        total: missingIssues + formatIssues,
      },
    };
  }

  public applyMappingAndParse(
    csvContent: string,
    mappingOverride: Array<{ sourceColumn: string; targetField: string }>,
    dateOverrides?: { field: string; format: string }[]
  ): EmployeeChange[] {
    const result = parseCsv(csvContent);
    const allRows = result.data as Record<string, any>[];

    const sourceToTarget = new Map(mappingOverride.map((m) => [m.sourceColumn, m.targetField]));
    const dateFormatMap = new Map<string, string>();
    if (dateOverrides) {
      dateOverrides.forEach(d => dateFormatMap.set(d.field, d.format));
    }

    return allRows.map((row, idx) => {
      const change: Record<string, any> = {
        id: `CHANGE_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'pending',
      };
      sourceToTarget.forEach((target, src) => {
        if (row[src] !== undefined) {
          if (target === 'effectiveDate') {
            const expectedFormat = dateFormatMap.get(target) || dateFormatMap.get(src) || undefined;
            const { normalized } = normalizeDate(String(row[src]), expectedFormat);
            change[target] = normalized;
          } else {
            change[target] = String(row[src]).trim();
          }
        }
      });
      return change as EmployeeChange;
    });
  }

  public generateTemplateCSV(): string {
    const headers = ['员工编号', '员工姓名', '原部门', '新部门', '新岗位', '生效日期', '新主管'];
    const sample = [
      ['E010', '郑小明', '前端开发组', '后端开发组', '高级前端工程师', '2026-07-01', 'E003'],
      ['E011', '黄丽', '前端开发组', '产品经理组', '高级产品经理', '2026-07-01', 'E005'],
    ];
    const lines = [headers.join(','), ...sample.map((r) => r.join(','))];
    return lines.join('\n');
  }
}

export const importPrecheckService = new ImportPrecheckService();
