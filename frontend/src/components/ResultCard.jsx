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
  return (
    <div className="card">
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

      <div className={isExchange ? 'decision decision-exchange' : 'decision'}>
        <LoopIcon />
        <div>
          <div className="verb">{r.decision}</div>
          <div className="why">{r.decisionReason}</div>
        </div>
      </div>

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
