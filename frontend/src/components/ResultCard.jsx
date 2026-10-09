import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';
const GRADE_COLOR = { A: 'var(--gA)', B: 'var(--gB)', C: 'var(--gC)', D: 'var(--gD)', INSPECT: 'var(--gI)' };
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

function LoopIcon() {
  return (
    <svg className="ring" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
    </svg>
  );
}

function ListForExchange({ r }) {
  const { token } = useAuth();
  const [state, setState] = useState('idle'); // 'idle' | 'listing' | 'listed' | 'error'
  const [message, setMessage] = useState(null);

  const isRecommended = r.decision === 'EXCHANGE';

  async function listForExchange() {
    setState('listing');
    try {
      await axios.post(
        `${API}/exchange/list`,
        { gradeId: r.gradeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setState('listed');
      setMessage(`Listed! Nearby users interested in ${r.category} will be notified.`);
    } catch (err) {
      setState('error');
      const errMsg = err.response?.data?.error;
      setMessage(
        errMsg === 'This item is already listed for exchange'
          ? 'This item is already listed for exchange.'
          : errMsg || 'Could not list this item for exchange.'
      );
    }
  }

  if (state === 'listed') {
    return <div className="list-exchange-row exchange-toast">{message}</div>;
  }

  return (
    <div className="list-exchange-row">
      <button
        className={isRecommended ? 'btn list-exchange-btn' : 'btn-secondary list-exchange-btn'}
        type="button"
        disabled={state === 'listing'}
        onClick={listForExchange}
      >
        {state === 'listing'
          ? 'Listing…'
          : isRecommended
            ? 'List for P2P Exchange (Recommended)'
            : 'List for P2P Exchange instead'}
      </button>
      {state === 'error' && <div className="exchange-toast exchange-toast-error">{message}</div>}
    </div>
  );
}

export default function ResultCard({ r }) {
  if (r.decision === 'NOT_A_PRODUCT') {
    return (
      <div className="card card-warn">
        <div className="card-top">
          <div>
            <div className="eyebrow">Product Health Card</div>
            <h3 className="item-name">Not a recognizable product</h3>
            <div className="item-sub">{r.reasoning}</div>
          </div>
        </div>

        <div className="body">
          <div className="warn">
            <span>⚠</span>
            <span>{r.decisionReason}</span>
          </div>
        </div>

        <div className="src">
          Graded by {r.source === 'bedrock' ? 'Amazon Bedrock (Nova Lite) vision' : r.source === 'gemini' ? 'Gemini vision' : r.cached ? 'cached demo response' : 'demo mock'} · routing by deterministic rule engine
        </div>
      </div>
    );
  }

  const gradeColor = GRADE_COLOR[r.conditionGrade] || 'var(--gI)';
  const isExchange = r.decision === 'EXCHANGE';
  const needsReview = r.decision === 'NEEDS_REVIEW';
  return (
    <div className={needsReview ? 'card card-warn' : 'card'}>
      <div className="card-top">
        <div>
          <div className="eyebrow">Product Health Card</div>
          {r.brand && r.name && (
            <div className="product-match">{r.brand} · {r.name}</div>
          )}
          <h3 className="item-name">{r.item}</h3>
          <div className="item-sub">{r.category} · {r.reasoning}</div>
        </div>
        <div className="grade" style={{ background: gradeColor }}>
          {r.conditionGrade}<small>GRADE</small>
        </div>
      </div>

      {needsReview ? (
        <div className="decision decision-review">
          <span className="decision-review-icon">⚠</span>
          <div>
            <div className="verb">Needs review</div>
            <div className="why">Low confidence — flagged for manual review</div>
          </div>
        </div>
      ) : (
        <div className={isExchange ? 'decision decision-exchange' : 'decision'}>
          <LoopIcon />
          <div>
            <div className="verb">{r.decision}</div>
            <div className="why">{r.decisionReason}</div>
          </div>
        </div>
      )}

      <div className="body">
        <div className="row">
          <span className="k">Condition confidence</span>
          <div className="meter"><span style={{ width: r.confidence + '%' }} /></div>
          <span className="val">{r.confidence}%</span>
        </div>
        <div className="row price">
          <span className="k">{isExchange ? 'Estimated exchange value' : 'Estimated value'}</span>
          <span className="val">
            {r.resalePriceInr > 0
              ? (<><span className="old">{inr(r.originalPriceInr)}</span><span className="new">{inr(r.resalePriceInr)}</span></>)
              : <span style={{ color: 'var(--muted)' }}>Non-resale route</span>}
          </span>
        </div>
        <div className="row">
          <span className="k">History</span>
          <span className="val">{r.history}</span>
        </div>
        <div className="row">
          <span className="k">Warranty status</span>
          <span className="val">{r.warrantyStatus}</span>
        </div>

        {r.detectedFlaws?.length > 0 && (
          <div className="flags">
            {r.detectedFlaws.map((f, i) => <span key={i} className="chip">{f}</span>)}
          </div>
        )}

        {r.usedAsNewRisk && (
          <div className="warn">
            <span>⚠</span>
            <span>Return-fraud signal: item shows prior use despite a "new" return claim — routed to {isExchange ? 'peer-to-peer exchange' : 'certified refurbish'} instead of full resale.</span>
          </div>
        )}

        <div className="eco">
          <div className="stat">
            <div className="num">{r.greenCredits}</div>
            <div className="lbl">Green credits earned</div>
          </div>
          <div className="stat">
            <div className="num">{r.co2SavedKg} kg</div>
            <div className="lbl">CO₂ kept out of landfill</div>
          </div>
        </div>
      </div>

      <ListForExchange r={r} />

      {r.recommendations?.length > 0 && (
        <div className="recs">
          <h4>Certified refurbished you might like</h4>
          {r.recommendations.map((p, i) => (
            <div className="rec" key={i}><span>{p.name}</span><span className="rp">{inr(p.priceInr)}</span></div>
          ))}
        </div>
      )}

      <div className="src">
        Graded by {r.source === 'bedrock' ? 'Amazon Bedrock (Nova Lite) vision' : r.source === 'gemini' ? 'Gemini vision' : r.cached ? 'cached demo response' : 'demo mock'} · routing by deterministic rule engine
      </div>
    </div>
  );
}
