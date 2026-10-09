import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';
const POLL_MS = 30000;

export default function ReviewBadge() {
  const { token } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await axios.get(`${API}/review/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setCount(data.queue.length);
      } catch {
        // Silent — this runs on a timer, so a transient failure shouldn't
        // disrupt the rest of the UI.
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  return (
    <Link className="tab review-tab" to="/review">
      Review{count > 0 && <span className="review-badge">{count}</span>}
    </Link>
  );
}
