import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocation as useUserLocation } from '../hooks/useLocation';

const API = 'http://localhost:5000';
const CATEGORIES = ['electronics', 'footwear', 'apparel', 'home', 'sports', 'toys'];

const LOCATION_STATUS_TEXT = {
  requesting: 'Requesting your location…',
  granted: "Location shared — you'll get nearby match alerts.",
  denied: 'Location permission denied. Enable it in your browser settings to get nearby matches.',
  error: 'Could not get your location. Try again.'
};

export default function InterestSettings() {
  const { token } = useAuth();
  const { requestLocation, locationStatus } = useUserLocation();
  const [interests, setInterests] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [toast, setToast] = useState(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/interest`, authHeaders);
        setInterests(new Set(data.interests));
      } catch {
        // leave interests empty on failure
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggle(category, checked) {
    setPendingCategory(category);
    try {
      if (checked) {
        const { data } = await axios.post(`${API}/interest`, { category }, authHeaders);
        setInterests((prev) => new Set(prev).add(category));
        setToast({ type: 'success', message: data.message });
      } else {
        const { data } = await axios.delete(`${API}/interest/${category}`, authHeaders);
        setInterests((prev) => {
          const next = new Set(prev);
          next.delete(category);
          return next;
        });
        setToast({ type: 'success', message: data.message });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Could not update interest.' });
    } finally {
      setPendingCategory(null);
    }
  }

  return (
    <div className="form-card interest-settings">
      <h2>Exchange interests</h2>
      <p className="interest-sub">
        Get notified when someone nearby lists an item in a category you care about.
      </p>

      {toast && (
        <div className={toast.type === 'error' ? 'exchange-toast exchange-toast-error' : 'exchange-toast'}>
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="scan"><span className="dot" /> Loading your interests…</div>
      ) : (
        <div className="interest-grid">
          {CATEGORIES.map((category) => (
            <label className="interest-checkbox" key={category}>
              <input
                type="checkbox"
                checked={interests.has(category)}
                disabled={pendingCategory === category}
                onChange={(e) => toggle(category, e.target.checked)}
              />
              {category}
            </label>
          ))}
        </div>
      )}

      <div className="interest-location">
        <button
          className="btn"
          type="button"
          onClick={requestLocation}
          disabled={locationStatus === 'requesting'}
        >
          Share my location to get nearby exchange matches
        </button>
        {locationStatus !== 'idle' && (
          <div className={locationStatus === 'denied' || locationStatus === 'error' ? 'err' : 'auth-success'}>
            {LOCATION_STATUS_TEXT[locationStatus]}
          </div>
        )}
      </div>
    </div>
  );
}
