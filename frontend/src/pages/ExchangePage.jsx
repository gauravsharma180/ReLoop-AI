import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

// Same palette as the Product Health Card / History page — a Grade B badge
// looks identical everywhere in the app.
const GRADE_COLOR = { A: 'var(--gA)', B: 'var(--gB)', C: 'var(--gC)', D: 'var(--gD)' };

function GradeBadge({ grade }) {
  if (!grade) return null;
  return (
    <div className="grade" style={{ background: GRADE_COLOR[grade] || 'var(--gI)' }}>
      {grade}<small>GRADE</small>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'claimed') {
    return <span className="status-badge status-claimed">Claimed ✓</span>;
  }
  if (status === 'available') {
    return <span className="status-badge status-available">Available</span>;
  }
  return <span className="status-badge status-expired">{status}</span>;
}

function formatDate(isoDatetime) {
  // Postgres TIMESTAMPTZ columns arrive as JSON already in full ISO 8601
  // (e.g. "2026-09-18T09:47:39.000Z") — no reformatting needed.
  const d = new Date(isoDatetime);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function ExchangePage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('available');

  const [available, setAvailable] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [availableError, setAvailableError] = useState(null);

  const [listedByMe, setListedByMe] = useState([]);
  const [claimedByMe, setClaimedByMe] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [mineError, setMineError] = useState(null);

  const [claimingId, setClaimingId] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const loadAvailable = useCallback(async () => {
    setLoadingAvailable(true);
    setAvailableError(null);
    try {
      const { data } = await axios.get(`${API}/exchange/available`, authHeaders);
      setAvailable(data.listings);
    } catch (err) {
      setAvailableError(err.response?.data?.error || 'Could not load the exchange board.');
    } finally {
      setLoadingAvailable(false);
    }
  }, [token]);

  const loadMyListings = useCallback(async () => {
    setLoadingMine(true);
    setMineError(null);
    try {
      const { data } = await axios.get(`${API}/exchange/my-listings`, authHeaders);
      setListedByMe(data.listedByMe);
      setClaimedByMe(data.claimedByMe);
    } catch (err) {
      setMineError(err.response?.data?.error || 'Could not load your exchanges.');
    } finally {
      setLoadingMine(false);
    }
  }, [token]);

  useEffect(() => {
    loadAvailable();
    loadMyListings();
  }, [loadAvailable, loadMyListings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function claim(id) {
    setClaimingId(id);
    try {
      await axios.post(`${API}/exchange/${id}/claim`, {}, authHeaders);
      setAvailable((prev) => prev.filter((l) => l.id !== id));
      setToast({ type: 'success', message: 'Item claimed! Contact the lister to arrange handover.' });
      loadMyListings();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Could not claim this item.' });
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="wrap">
      <div className="history-header">
        <h2>Exchange board</h2>
        <Link to="/" className="history-back">← Back to grading</Link>
      </div>

      <nav className="tabs">
        <button className={tab === 'available' ? 'tab active' : 'tab'} onClick={() => setTab('available')}>
          Available
        </button>
        <button className={tab === 'mine' ? 'tab active' : 'tab'} onClick={() => setTab('mine')}>
          My Exchanges
        </button>
      </nav>

      {toast && (
        <div className={toast.type === 'error' ? 'exchange-toast exchange-toast-error' : 'exchange-toast'}>
          {toast.message}
        </div>
      )}

      {tab === 'available' && (
        <>
          {loadingAvailable && (
            <div className="scan"><span className="dot" /> Loading exchange board…</div>
          )}

          {!loadingAvailable && availableError && <div className="err">{availableError}</div>}

          {!loadingAvailable && !availableError && available.length === 0 && (
            <div className="history-empty">
              No items available for exchange right now — check back soon or list your own.
            </div>
          )}

          {!loadingAvailable && !availableError && available.length > 0 && (
            <div className="history-list">
              {available.map((l) => (
                <div className="card exchange-card" key={l.id}>
                  <div className="card-top">
                    <div>
                      <h3 className="item-name">{l.item_name}</h3>
                      <div className="item-sub">{l.category}</div>
                      {l.original_decision && l.original_decision !== 'EXCHANGE' && (
                        <div className="ai-recommended">AI recommended: {l.original_decision}</div>
                      )}
                    </div>
                    <GradeBadge grade={l.grade} />
                  </div>
                  <div className="body">
                    <button
                      className="btn claim-btn"
                      type="button"
                      disabled={claimingId === l.id}
                      onClick={() => claim(l.id)}
                    >
                      {claimingId === l.id ? 'Claiming…' : 'Claim'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        <>
          {loadingMine && (
            <div className="scan"><span className="dot" /> Loading your exchanges…</div>
          )}

          {!loadingMine && mineError && <div className="err">{mineError}</div>}

          {!loadingMine && !mineError && (
            <>
              <h4 className="exchange-section-title">Listed by you</h4>
              {listedByMe.length === 0 ? (
                <div className="history-empty">You haven't listed any items for exchange yet.</div>
              ) : (
                <div className="history-list">
                  {listedByMe.map((l) => (
                    <div className="card exchange-card" key={l.id}>
                      <div className="card-top">
                        <div>
                          <h3 className="item-name">{l.item_name}</h3>
                          <div className="item-sub-row">
                            <StatusBadge status={l.status} />
                          </div>
                          {l.original_decision && l.original_decision !== 'EXCHANGE' && (
                            <div className="ai-recommended">You listed this instead of: {l.original_decision}</div>
                          )}
                        </div>
                        <GradeBadge grade={l.grade} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="exchange-section-title">Claimed by you</h4>
              {claimedByMe.length === 0 ? (
                <div className="history-empty">You haven't claimed any items yet.</div>
              ) : (
                <div className="history-list">
                  {claimedByMe.map((l) => (
                    <div className="card exchange-card" key={l.id}>
                      <div className="card-top">
                        <div>
                          <h3 className="item-name">{l.item_name}</h3>
                          <div className="item-sub-row">
                            <StatusBadge status={l.status} />
                            {l.claimed_at && <span className="item-sub">· claimed {formatDate(l.claimed_at)}</span>}
                          </div>
                        </div>
                        <GradeBadge grade={l.grade} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
