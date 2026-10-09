import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

// Same palette as the Product Health Card (ResultCard.jsx).
const GRADE_COLOR = { A: 'var(--gA)', B: 'var(--gB)', C: 'var(--gC)', D: 'var(--gD)' };

const DECISION_OPTIONS = [
  { value: 'RESELL', label: 'Resell' },
  { value: 'REFURBISH', label: 'Refurbish' },
  { value: 'DONATE', label: 'Donate' },
  { value: 'RECYCLE', label: 'Recycle' },
  { value: 'EXCHANGE', label: 'Exchange' }
];

function formatDate(isoDatetime) {
  // Postgres TIMESTAMPTZ columns arrive as JSON already in full ISO 8601
  // (e.g. "2026-09-18T09:47:39.000Z") — no reformatting needed.
  const d = new Date(isoDatetime);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function ReviewQueuePage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [choices, setChoices] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveErrors, setResolveErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API}/review/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setQueue(data.queue);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load the review queue.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function resolve(id) {
    const decision = choices[id];
    if (!decision) return;

    setResolvingId(id);
    setResolveErrors((prev) => ({ ...prev, [id]: null }));
    try {
      await axios.patch(
        `${API}/review/${id}/resolve`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQueue((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setResolveErrors((prev) => ({ ...prev, [id]: err.response?.data?.error || 'Could not resolve this item.' }));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="wrap">
      <div className="history-header">
        <h2>Review queue</h2>
        <Link to="/" className="history-back">← Back to grading</Link>
      </div>

      {loading && (
        <div className="scan"><span className="dot" /> Loading review queue…</div>
      )}

      {!loading && error && <div className="err">{error}</div>}

      {!loading && !error && queue.length === 0 && (
        <div className="history-empty">No items need review</div>
      )}

      {!loading && !error && queue.length > 0 && (
        <div className="history-list">
          {queue.map((g) => {
            const gradeColor = GRADE_COLOR[g.grade] || 'var(--gI)';
            return (
              <div className="card history-card" key={g.id}>
                <div className="card-top">
                  <div>
                    <div className="eyebrow">{formatDate(g.created_at)}</div>
                    <h3 className="item-name">{g.item_name}</h3>
                    <div className="item-sub">{g.category}</div>
                  </div>
                  {g.grade && (
                    <div className="grade" style={{ background: gradeColor }}>
                      {g.grade}<small>GRADE</small>
                    </div>
                  )}
                </div>

                <div className="body">
                  <div className="row">
                    <span className="k">Condition confidence</span>
                    <div className="meter"><span style={{ width: g.confidence + '%' }} /></div>
                    <span className="val">{g.confidence}%</span>
                  </div>

                  {g.flaws.length > 0 && (
                    <div className="flags">
                      {g.flaws.map((f, i) => <span key={i} className="chip">{f}</span>)}
                    </div>
                  )}

                  <div className="warn">
                    <span>⚠</span>
                    <span>Low confidence — flagged for manual review</span>
                  </div>

                  <div className="review-resolve-row">
                    <select
                      className="review-select"
                      value={choices[g.id] || ''}
                      onChange={(e) => setChoices((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      disabled={resolvingId === g.id}
                    >
                      <option value="" disabled>Choose routing…</option>
                      {DECISION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn"
                      disabled={!choices[g.id] || resolvingId === g.id}
                      onClick={() => resolve(g.id)}
                    >
                      {resolvingId === g.id ? 'Resolving…' : 'Resolve'}
                    </button>
                  </div>

                  {resolveErrors[g.id] && <div className="err">{resolveErrors[g.id]}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
