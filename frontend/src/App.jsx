import { useState } from 'react';
import UploadScreen from './components/UploadScreen';
import CheckoutScreen from './components/CheckoutScreen';

export default function App() {
  const [tab, setTab] = useState('grade');

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
        <div className="tag">Every returned item, routed to its most valuable next life — in seconds.</div>
      </header>

      <nav className="tabs">
        <button className={tab === 'grade' ? 'tab active' : 'tab'} onClick={() => setTab('grade')}>
          Grade a return
        </button>
        <button className={tab === 'risk' ? 'tab active' : 'tab'} onClick={() => setTab('risk')}>
          Predict return risk
        </button>
      </nav>

      {tab === 'grade' ? <UploadScreen /> : <CheckoutScreen />}
    </div>
  );
}
