import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="sidebar-logo">
          <span style={{ fontSize: '30px' }}>🍴</span>
          <span>Smart Restaurant</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
            <span className="nav-icon">📊</span>
            Dashboard
          </Link>
          <Link to="/orders" className={`nav-link ${isActive('/orders') ? 'active' : ''}`}>
            <span className="nav-icon">📋</span>
            Orders
            <span className="nav-badge">5</span>
          </Link>
          <Link to="/items" className={`nav-link ${isActive('/items') ? 'active' : ''}`}>
            <span className="nav-icon">🍴</span>
            Menu Items
          </Link>
          <Link to="/categories" className={`nav-link ${isActive('/categories') ? 'active' : ''}`}>
            <span className="nav-icon">📁</span>
            Categories
          </Link>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            <span className="nav-icon">🪑</span>
            Tables
          </Link>
          <Link to="/users" className={`nav-link ${isActive('/users') ? 'active' : ''}`}>
            <span className="nav-icon">👥</span>
            Users
          </Link>
          <Link to="/reports" className={`nav-link ${isActive('/reports') ? 'active' : ''}`}>
            <span className="nav-icon">📈</span>
            Reports
          </Link>
          <Link to="/modifiers" className={`nav-link ${isActive('/modifiers') ? 'active' : ''}`}>
            <span className="nav-icon">🔧</span>
            Modifiers
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-profile">
            <div className="admin-avatar">
              {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'AD'}
            </div>
            <div className="admin-info">
              <div className="admin-name">{user?.full_name || user?.email}</div>
              <div className="admin-role">
                {user?.roles?.includes('super_admin') ? 'Super Admin' : 
                 user?.roles?.includes('admin') ? 'Restaurant Admin' : 'Staff'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-link">
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {children}
      </div>
    </div>
  );
}
