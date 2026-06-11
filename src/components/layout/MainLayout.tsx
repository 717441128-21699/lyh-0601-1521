import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileCheck2, 
  PlayCircle, 
  Undo2, 
  BarChart3,
  Users,
  Bell,
  Search,
  Settings
} from 'lucide-react';
import { useEffect } from 'react';
import { useHRStore } from '@/stores/hrStore';

const navItems = [
  { path: '/', label: '主工作台', icon: LayoutDashboard, desc: '清单导入与校验' },
  { path: '/impact', label: '影响分析', icon: FileCheck2, desc: '审批/考勤/成本中心' },
  { path: '/execute', label: '批量执行', icon: PlayCircle, desc: '分批提交与重试' },
  { path: '/rollback', label: '回滚中心', icon: Undo2, desc: '变更记录与撤回' },
  { path: '/report', label: '报告中心', icon: BarChart3, desc: '成功失败明细' },
];

export default function MainLayout() {
  const location = useLocation();
  const fetchMasterData = useHRStore(s => s.fetchMasterData);
  const fetchAllReports = useHRStore(s => s.fetchAllReports);
  const fetchRollbackRecords = useHRStore(s => s.fetchRollbackRecords);

  useEffect(() => {
    fetchMasterData();
    fetchAllReports();
    fetchRollbackRecords();
  }, [fetchMasterData, fetchAllReports, fetchRollbackRecords]);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-slate-200/70 flex flex-col shadow-sm">
        <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center shadow-md shadow-primary-200">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">HR异动中心</h1>
            <p className="text-xs text-slate-500">批量处理系统</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item, idx) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `${
                isActive ? 'nav-item-active' : 'nav-item'
              } animate-fade-in animate-stagger-${idx + 1}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className={`text-xs ${location.pathname === item.path ? 'text-primary-600' : 'text-slate-400'}`}>
                  {item.desc}
                </div>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
              Z
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">周芳 (HR专员)</div>
              <div className="text-xs text-slate-500">人力资源部</div>
            </div>
            <Settings className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30">
          <div className="h-full px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {navItems.find(n => n.path === location.pathname)?.label || '主工作台'}
                </h2>
                <p className="text-xs text-slate-500">
                  {navItems.find(n => n.path === location.pathname)?.desc || ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索员工、部门..."
                  className="pl-10 pr-4 py-2 w-64 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <button className="relative w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
