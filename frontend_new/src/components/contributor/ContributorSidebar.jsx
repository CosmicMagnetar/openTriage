import { FileText, LogOut, BarChart3, Settings, Menu, X, User, MessageSquare, TrendingUp, Building2, Home } from 'lucide-react';
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
    const interval = setInterval(checkUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { icon: FileText, label: 'My Issues', path: '/' },
    { icon: MessageSquare, label: 'Messages', path: '/messages', badge: unreadCount },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: BarChart3, label: 'Metrics', path: '/metrics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: Home, label: 'Landing Page', path: '/landing', external: true }
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
        className="lg:hidden fixed top-4 left-4 z-50 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,70%)] p-2.5 rounded-lg border border-[hsl(220,13%,18%)] hover:bg-[hsl(220,13%,15%)] transition-colors"
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Properly framed */}
      <div
        data-testid="contributor-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[hsl(220,13%,7%)] border-r border-[hsl(220,13%,14%)] flex flex-col transition-transform duration-200 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Logo Section - Well framed */}
        <div className="p-5 border-b border-[hsl(220,13%,14%)]">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <h1 className="text-base font-semibold text-[hsl(210,11%,90%)]">OpenTriage</h1>
              <p className="text-[10px] text-[hsl(142,70%,55%)] font-medium">Contributor</p>
            </div>
          </div>
        </div>

        {/* User Info - Card style */}
        <div className="px-4 py-4 border-b border-[hsl(220,13%,14%)]">
          <div className="flex items-center gap-3 p-3 bg-[hsl(220,13%,10%)] rounded-lg border border-[hsl(220,13%,16%)]">
            <img
              src={user?.avatarUrl || 'https://github.com/ghost.png'}
              alt={user?.username}
              className="w-9 h-9 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(210,11%,85%)] truncate">
                {user?.username}
              </p>
              <p className="text-[10px] text-[hsl(210,11%,50%)]">Open Source Contributor</p>
            </div>
          </div>
        </div>

        {/* Menu - Better spacing */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="text-[10px] text-[hsl(210,11%,40%)] uppercase tracking-wider px-3 mb-2">Navigation</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${isActive
                  ? 'bg-[hsl(142,70%,45%,0.12)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.2)]'
                  : 'text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)] hover:text-[hsl(210,11%,80%)] border border-transparent'
                  }`}
              >
                <div className="relative">
                  <Icon className="w-4.5 h-4.5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout - Well framed */}
        <div className="p-3 border-t border-[hsl(220,13%,14%)]">
          <button
            data-testid="logout-button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(210,11%,50%)] hover:bg-[hsl(0,60%,50%,0.1)] hover:text-[hsl(0,60%,60%)] transition-colors border border-transparent hover:border-[hsl(0,60%,50%,0.2)]"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default ContributorSidebar;