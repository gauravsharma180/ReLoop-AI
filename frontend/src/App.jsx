import { useState } from 'react';
import { Link } from 'react-router-dom';
import UploadScreen from './components/UploadScreen';
import CheckoutScreen from './components/CheckoutScreen';
import NotificationBell from './components/NotificationBell';
import ReviewBadge from './components/ReviewBadge';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [tab, setTab] = useState('grade');
  const { user, logout } = useAuth();

  return (
    <div className="wrap">
      <header className="mast">
        <div className="brand">
          <svg className="loop" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
          </svg>
          ReLoop-AI
        </div>
        <div className="mast-right">
          <div className="tag">Every returned item, routed to its most valuable next life — in seconds.</div>
          <div className="account">
            {user && <NotificationBell />}
            <span>{user?.email}</span>
            <button className="logout-btn" type="button" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'grade' ? 'tab active' : 'tab'} onClick={() => setTab('grade')}>
          Grade a return
        </button>
        <button className={tab === 'risk' ? 'tab active' : 'tab'} onClick={() => setTab('risk')}>
          Predict return risk
        </button>
        <Link className="tab" to="/dashboard">Dashboard</Link>
        <ReviewBadge />
        <Link className="tab" to="/history">History</Link>
        <Link className="tab" to="/exchange">Exchange board</Link>
        <Link className="tab" to="/settings">Settings</Link>
        {user?.role === 'admin' && <Link className="tab" to="/admin">Admin</Link>}
      </nav>

      {tab === 'grade' ? <UploadScreen /> : <CheckoutScreen />}
    </div>
  );
}
