import type { Department, Position, Employee } from '../../shared/types';

export const DEPARTMENTS: Department[] = [
  { id: 'D001', name: '技术研发部', parentId: null, managerId: 'E001', costCenter: 'CC-RD-001' },
  { id: 'D002', name: '前端开发组', parentId: 'D001', managerId: 'E002', costCenter: 'CC-RD-001' },
  { id: 'D003', name: '后端开发组', parentId: 'D001', managerId: 'E003', costCenter: 'CC-RD-001' },
  { id: 'D004', name: '产品设计部', parentId: null, managerId: 'E004', costCenter: 'CC-PD-001' },
  { id: 'D005', name: '产品经理组', parentId: 'D004', managerId: 'E005', costCenter: 'CC-PD-001' },
  { id: 'D006', name: 'UI设计组', parentId: 'D004', managerId: 'E006', costCenter: 'CC-PD-001' },
  { id: 'D007', name: '市场营销部', parentId: null, managerId: 'E007', costCenter: 'CC-MK-001' },
  { id: 'D008', name: '人力资源部', parentId: null, managerId: 'E008', costCenter: 'CC-HR-001' },
  { id: 'D009', name: '财务部', parentId: null, managerId: 'E009', costCenter: 'CC-FN-001' },
  { id: 'D010', name: '运营部', parentId: null, managerId: null, costCenter: 'CC-OPS-001' },
];

export const POSITIONS: Position[] = [
  { id: 'P001', name: '技术总监', level: 'L8', departmentId: 'D001' },
  { id: 'P002', name: '前端架构师', level: 'L7', departmentId: 'D002' },
  { id: 'P003', name: '高级前端工程师', level: 'L6', departmentId: 'D002' },
  { id: 'P004', name: '前端工程师', level: 'L5', departmentId: 'D002' },
  { id: 'P005', name: '后端架构师', level: 'L7', departmentId: 'D003' },
  { id: 'P006', name: '高级后端工程师', level: 'L6', departmentId: 'D003' },
  { id: 'P007', name: '产品总监', level: 'L8', departmentId: 'D004' },
  { id: 'P008', name: '高级产品经理', level: 'L6', departmentId: 'D005' },
  { id: 'P009', name: '产品经理', level: 'L5', departmentId: 'D005' },
  { id: 'P010', name: 'UI设计师', level: 'L5', departmentId: 'D006' },
  { id: 'P011', name: '市场总监', level: 'L8', departmentId: 'D007' },
  { id: 'P012', name: 'HRBP', level: 'L5', departmentId: 'D008' },
  { id: 'P013', name: '财务会计', level: 'L5', departmentId: 'D009' },
  { id: 'P014', name: '运营专员', level: 'L4', departmentId: 'D010' },
  { id: 'P015', name: '后端工程师', level: 'L5', departmentId: 'D003' },
];

export const EMPLOYEES: Employee[] = [
  { id: 'E001', name: '张伟', departmentId: 'D001', positionId: 'P001', managerId: null, costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E002', name: '李娜', departmentId: 'D002', positionId: 'P002', managerId: 'E001', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E003', name: '王强', departmentId: 'D003', positionId: 'P005', managerId: 'E001', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E004', name: '刘洋', departmentId: 'D004', positionId: 'P007', managerId: null, costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E005', name: '陈静', departmentId: 'D005', positionId: 'P008', managerId: 'E004', costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E006', name: '赵敏', departmentId: 'D006', positionId: 'P010', managerId: 'E004', costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E007', name: '孙磊', departmentId: 'D007', positionId: 'P011', managerId: null, costCenter: 'CC-MK-001', attendanceGroup: 'AT-SALES' },
  { id: 'E008', name: '周芳', departmentId: 'D008', positionId: 'P012', managerId: null, costCenter: 'CC-HR-001', attendanceGroup: 'AT-STD' },
  { id: 'E009', name: '吴涛', departmentId: 'D009', positionId: 'P013', managerId: null, costCenter: 'CC-FN-001', attendanceGroup: 'AT-STD' },
  { id: 'E010', name: '郑小明', departmentId: 'D002', positionId: 'P004', managerId: 'E002', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E011', name: '黄丽', departmentId: 'D002', positionId: 'P003', managerId: 'E002', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E012', name: '林浩', departmentId: 'D003', positionId: 'P006', managerId: 'E003', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E013', name: '何婷', departmentId: 'D005', positionId: 'P009', managerId: 'E005', costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E014', name: '罗宇', departmentId: 'D006', positionId: 'P010', managerId: 'E006', costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E015', name: '谢雯', departmentId: 'D002', positionId: 'P004', managerId: 'E002', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E016', name: '陈志远', departmentId: 'D003', positionId: 'P015', managerId: 'E003', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E017', name: '刘梦琪', departmentId: 'D002', positionId: 'P004', managerId: 'E002', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E018', name: '杨帆', departmentId: 'D005', positionId: 'P009', managerId: 'E005', costCenter: 'CC-PD-001', attendanceGroup: 'AT-STD' },
  { id: 'E019', name: '徐浩', departmentId: 'D003', positionId: 'P015', managerId: 'E003', costCenter: 'CC-RD-001', attendanceGroup: 'AT-TECH' },
  { id: 'E020', name: '郭晓彤', departmentId: 'D007', positionId: 'P014', managerId: 'E007', costCenter: 'CC-MK-001', attendanceGroup: 'AT-SALES' },
];

export const getDepartmentById = (id: string): Department | undefined => {
  return DEPARTMENTS.find(d => d.id === id || d.name === id);
};

export const getPositionById = (id: string): Position | undefined => {
  return POSITIONS.find(p => p.id === id || p.name === id);
};

export const getEmployeeById = (id: string): Employee | undefined => {
  return EMPLOYEES.find(e => e.id === id || e.name === id);
};

export const getDepartmentName = (id: string): string => {
  return getDepartmentById(id)?.name || id;
};

export const getPositionName = (id: string): string => {
  return getPositionById(id)?.name || id;
};

export const getEmployeeName = (id: string): string => {
  return getEmployeeById(id)?.name || id;
};
