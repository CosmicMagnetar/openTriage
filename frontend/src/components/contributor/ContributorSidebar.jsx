import { FileText, LogOut, BarChart3, Settings, Menu, X, User, Bell, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useAuthStore from '../../stores/authStore';
import Logo from '../Logo';

const ContributorSidebar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread messages
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/messaging/unread-count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count || 0);
        }
      } catch (error) {
        console.error('Failed to check unread messages:', error);
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { icon: FileText, label: 'My Issues', path: '/' },
    { icon: MessageSquare, label: 'Messages', path: '/messages', badge: unreadCount },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: BarChart3, label: 'Metrics', path: '/metrics' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ];

  const handleNavigation = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 text-slate-200 p-3 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        data-testid="contributor-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-slate-800/80 backdrop-blur-sm border-r border-slate-700 flex flex-col rounded-r-xl transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <Logo size="md" />
          <h1 className="text-xl font-bold text-slate-200 mt-3">OpenTriage</h1>
          <p className="text-xs text-emerald-400 mt-1">Contributor</p>
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
              <p className="text-xs text-slate-400">Contributor</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
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
    </>
  );
};

export default ContributorSidebar;