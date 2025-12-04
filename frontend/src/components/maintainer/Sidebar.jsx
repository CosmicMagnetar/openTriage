import { LayoutDashboard, FileText, BarChart3, GitPullRequest, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: GitPullRequest, label: 'PR Management', path: '/pr-management' },
    { icon: FileText, label: 'Templates', path: '/templates' },
    { icon: BarChart3, label: 'Metrics', path: '/metrics' }
  ];

  return (
    <div
      data-testid="maintainer-sidebar"
      className="w-64 bg-slate-800/80 backdrop-blur-sm border-r border-slate-700 flex flex-col rounded-r-xl"
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex gap-2 items-end mb-3">
          <div className="w-6 h-5 bg-red-500 rounded" />
          <div className="w-6 h-8 bg-blue-500 rounded" />
          <div className="w-6 h-12 bg-emerald-500 rounded" />
        </div>
        <h1 className="text-xl font-bold text-slate-200">OpenTriage</h1>
        <p className="text-xs text-blue-400 mt-1">Maintainer</p>
      </div>

      {/* User Info */}
      <div className="px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <img
            src={user?.avatarUrl || 'https://github.com/ghost.png'}
            alt={user?.username}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {user?.username}
            </p>
            <p className="text-xs text-slate-400">Maintainer</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-300 ${isActive
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button
          data-testid="logout-button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-300"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;