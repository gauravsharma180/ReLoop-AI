import { useEffect, useState } from 'react';
import { predictReturn } from '../api';

const RISK_COLOR = { LOW: 'var(--gA)', MEDIUM: 'var(--gB)', HIGH: 'var(--gD)' };

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'home', label: 'Home' },
];

const DEFAULT_SIGNALS = {
  category: 'footwear',
  price_inr: 2499,
  size_selected: false,
  returned_before: 2,
  review_avg: 3.0,
};

export default function CheckoutScreen() {
  const [signals, setSignals] = useState(DEFAULT_SIGNALS);
  const [risk, setRisk] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    predictReturn(signals)
      .then((d) => { if (!cancelled) { setRisk(d); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Backend unreachable. Is it running on :5000?'); });
    return () => { cancelled = true; };
  }, [signals]);

  const set = (key) => (e) => {
    const { type, checked, value } = e.target;
    const v = type === 'checkbox' ? checked : type === 'number' ? Number(value) : value;
    setSignals((s) => ({ ...s, [key]: v }));
  };

  return (
    <>
      <div className="form-card">
        <h2>Checkout signals</h2>
        <div className="field">
          <label>Product category</label>
          <select value={signals.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Price (₹)</label>
          <input type="number" min="0" value={signals.price_inr} onChange={set('price_inr')} />
        </div>
        <div className="field checkbox">
          <label>
            <input type="checkbox" checked={signals.size_selected} onChange={set('size_selected')} />
            Customer selected a size
          </label>
        </div>
        <div className="field">
          <label>Customer's past returns</label>
          <input type="number" min="0" value={signals.returned_before} onChange={set('returned_before')} />
        </div>
        <div className="field">
          <label>Product review average (0–5)</label>
          <input type="number" min="0" max="5" step="0.1" value={signals.review_avg} onChange={set('review_avg')} />
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      {risk && !error && (
        <div className="card">
          <div className="card-top">
            <div>
              <h3 className="item-name">Return risk</h3>
              <div className="item-sub">Scored at checkout, before the order ships</div>
            </div>
            <div className="grade" style={{ background: RISK_COLOR[risk.risk_band] }}>
              {risk.risk_score}<small>{risk.risk_band}</small>
            </div>
          </div>

          <div className="body">
            <div className="row">
              <span className="k">Risk score</span>
              <div className="meter"><span style={{ width: risk.risk_score + '%', background: RISK_COLOR[risk.risk_band] }} /></div>
              <span className="val">{risk.risk_score}%</span>
            </div>

            {risk.factors.length > 0 && (
              <div className="flags">
                {risk.factors.map((f, i) => <span key={i} className="chip">{f}</span>)}
              </div>
            )}

            <div className="warn">
              <span>💡</span>
              <span>{risk.recommended_nudge}</span>
            </div>
          </div>

          <div className="src">Deterministic rule engine · same signals available at checkout</div>
        </div>
      )}
    </>
  );
}
