import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

// Same palette as the Product Health Card (ResultCard.jsx) — a Grade B badge
// should look identical whether you're grading or browsing history.
const GRADE_COLOR = { A: 'var(--gA)', B: 'var(--gB)', C: 'var(--gC)', D: 'var(--gD)' };

function formatDate(sqliteDatetime) {
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no
  // offset marker — without the explicit "Z" some browsers parse it as local time.
  const d = new Date(sqliteDatetime.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function HistoryPage() {
  const { token } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(new Set());
  const [feedbackErrors, setFeedbackErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API}/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setGrades(data.grades);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submitFeedback(id, value) {
    setSubmittingId(id);
    setFeedbackErrors((prev) => ({ ...prev, [id]: null }));
    try {
      await axios.patch(
        `${API}/history/${id}/feedback`,
        { feedback: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, feedback: value } : g)));
      setJustSubmitted((prev) => new Set(prev).add(id));
    } catch (err) {
      setFeedbackErrors((prev) => ({ ...prev, [id]: err.response?.data?.error || 'Could not save feedback.' }));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="wrap">
      <div className="history-header">
        <h2>Grading history</h2>
        <Link to="/" className="history-back">← Back to grading</Link>
      </div>

      {loading && (
        <div className="scan"><span className="dot" /> Loading history…</div>
      )}

      {!loading && error && <div className="err">{error}</div>}

      {!loading && !error && grades.length === 0 && (
        <div className="history-empty">
          No items graded yet — go to <Link to="/">Grade a Return</Link> to get started.
        </div>
      )}

      {!loading && !error && grades.length > 0 && (
        <div className="history-list">
          {grades.map((g) => {
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
                <span className="k">Decision</span>
                <span className="val">{g.decision}</span>
              </div>
              <div className="row">
                <span className="k">Confidence</span>
                <div className="meter"><span style={{ width: g.confidence + '%' }} /></div>
                <span className="val">{g.confidence}%</span>
              </div>

              {g.fraud_flag === 1 && (
                <div className="warn">
                  <span>⚠</span>
                  <span>Return-fraud signal flagged on this item.</span>
                </div>
              )}
              {g.low_confidence_flag === 1 && (
                <div className="warn">
                  <span>⚠</span>
                  <span>Low confidence grading — may need manual review.</span>
                </div>
              )}

              <div className="feedback-row">
                {g.feedback === null ? (
                  <>
                    <span className="k">Was this grading accurate?</span>
                    <div className="feedback-btns">
                      <button
                        type="button"
                        className="feedback-btn"
                        disabled={submittingId === g.id}
                        onClick={() => submitFeedback(g.id, 'correct')}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className="feedback-btn"
                        disabled={submittingId === g.id}
                        onClick={() => submitFeedback(g.id, 'incorrect')}
                      >
                        👎
                      </button>
                    </div>
                  </>
                ) : justSubmitted.has(g.id) ? (
                  <span className="feedback-done">
                    ✓ Marked as {g.feedback === 'correct' ? 'correct' : 'incorrect'}
                  </span>
                ) : g.feedback === 'correct' ? (
                  <span className="feedback-done feedback-correct">✓ Correct</span>
                ) : (
                  <span className="feedback-done feedback-incorrect">✗ Incorrect</span>
                )}
              </div>

              {feedbackErrors[g.id] && <div className="err">{feedbackErrors[g.id]}</div>}
            </div>
          </div>
        );
        })}
        </div>
      )}
    </div>
  );
}
