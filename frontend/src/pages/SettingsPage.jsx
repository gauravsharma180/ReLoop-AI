import { Link } from 'react-router-dom';
import InterestSettings from '../components/InterestSettings';

export default function SettingsPage() {
  return (
    <div className="wrap">
      <div className="history-header">
        <h2>Settings</h2>
        <Link to="/" className="history-back">← Back to grading</Link>
      </div>
      <InterestSettings />
    </div>
  );
}
