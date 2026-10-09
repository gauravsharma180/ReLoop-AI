import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';
const POLL_MS = 30000;

function relativeTime(isoDatetime) {
  // Postgres TIMESTAMPTZ columns arrive as JSON already in full ISO 8601.
  const then = new Date(isoDatetime).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/notifications`, authHeaders);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silent — this runs on a timer, so a transient failure shouldn't
      // disrupt the rest of the UI.
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function openNotification(n) {
    setOpen(false);
    try {
      await axios.patch(`${API}/notifications/${n.id}/read`, {}, authHeaders);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      if (!n.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Navigate regardless — failing to mark as read shouldn't block it.
    }
    navigate('/exchange');
  }

  async function markAllRead() {
    try {
      await axios.patch(`${API}/notifications/read-all`, {}, authHeaders);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore — next poll will resync state
    }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="bell-btn" type="button" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <span>Notifications</span>
            <button className="bell-markall" type="button" onClick={markAllRead}>
              Mark all as read
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="bell-empty">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={n.is_read ? 'bell-item' : 'bell-item bell-item-unread'}
                onClick={() => openNotification(n)}
              >
                <div className="bell-item-message">{n.message}</div>
                <div className="bell-item-time">{relativeTime(n.created_at)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
