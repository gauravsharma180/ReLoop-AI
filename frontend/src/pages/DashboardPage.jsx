import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';
const ACCENT = '#F0A030';

const GRADE_COLORS = { A: '#22C55E', B: '#3B82F6', C: '#F0A030', D: '#EF4444' };
const ROUTING_ORDER = ['Resell', 'Refurbish', 'Donate', 'Recycle', 'Exchange'];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function fraudGaugeColor(rate) {
  if (rate <= 5) return '#22C55E';
  if (rate <= 15) return ACCENT;
  return '#EF4444';
}

function SummaryCard({ label, value }) {
  return (
    <div className="dash-card dash-stat">
      <div className="dash-stat-val">{value}</div>
      <div className="dash-stat-lbl">{label}</div>
    </div>
  );
}

function FraudGauge({ rate }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(rate, 100) / 100);
  const color = fraudGaugeColor(rate);

  return (
    <div className="dash-gauge">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#2A2F3A" strokeWidth="12" />
        <circle
          cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
        <text x="65" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill="#E8EAED">
          {rate}%
        </text>
        <text x="65" y="80" textAnchor="middle" fontSize="10" fill="#8B93A1">flagged</text>
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${API}/analytics/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setData(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="dashboard-page">
      <div className="dash-wrap">
        <div className="dash-header">
          <h2>Dashboard</h2>
          <Link to="/" className="dash-back">← Back to grading</Link>
        </div>

        {loading && (
          <div className="dash-scan"><span className="dash-dot" /> Loading dashboard…</div>
        )}

        {!loading && error && <div className="dash-err">{error}</div>}

        {!loading && !error && data && data.totalGraded === 0 && (
          <div className="dash-empty">
            No items graded yet — go to <Link to="/">Grade a Return</Link> to start building your stats.
          </div>
        )}

        {!loading && !error && data && data.totalGraded > 0 && (
          <>
            <div className="dash-summary-grid">
              <SummaryCard label="Total Graded" value={data.totalGraded} />
              <SummaryCard label="Routing Accuracy" value={`${data.accuracyRate}%`} />
              <SummaryCard label="Value Recovered" value={inr(data.totalImpact.valueRecovered)} />
              <SummaryCard label="CO₂ Saved" value={`${data.totalImpact.co2Saved.toFixed(1)} kg`} />
            </div>

            <div className="dash-grid-2">
              <div className="dash-card">
                <h3 className="dash-card-title">Grade Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.gradeDistribution).map(([grade, count]) => ({ grade, count }))}
                      dataKey="count"
                      nameKey="grade"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {Object.keys(data.gradeDistribution).map((grade) => (
                        <Cell key={grade} fill={GRADE_COLORS[grade]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8B93A1' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="dash-card">
                <h3 className="dash-card-title">Routing Breakdown</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ROUTING_ORDER.map((k) => ({ name: k, count: data.routingBreakdown[k] || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2F3A" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#8B93A1', fontSize: 12 }} axisLine={{ stroke: '#2A2F3A' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#8B93A1', fontSize: 12 }} axisLine={{ stroke: '#2A2F3A' }} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#2A2F3A' }} />
                    <Bar dataKey="count" fill={ACCENT} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dash-card dash-card-wide">
              <h3 className="dash-card-title">Impact Over Time (last 14 days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.impactOverTime.map((d) => ({ ...d, label: formatShortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2F3A" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8B93A1', fontSize: 11 }} axisLine={{ stroke: '#2A2F3A' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#8B93A1', fontSize: 12 }} axisLine={{ stroke: '#2A2F3A' }} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => l} />
                  <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="dash-grid-2">
              <div className="dash-card">
                <h3 className="dash-card-title">Most Common Flaws</h3>
                {data.mostCommonFlaws.length === 0 ? (
                  <div className="dash-flaws-empty">No flaws recorded yet.</div>
                ) : (
                  <div className="dash-flaws">
                    {data.mostCommonFlaws.map(({ flaw, count }) => {
                      const max = data.mostCommonFlaws[0].count;
                      return (
                        <div className="dash-flaw-row" key={flaw}>
                          <span className="dash-flaw-name">{flaw}</span>
                          <div className="dash-flaw-bar-track">
                            <div className="dash-flaw-bar" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="dash-flaw-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="dash-card dash-card-center">
                <h3 className="dash-card-title">Fraud Flag Rate</h3>
                <FraudGauge rate={data.fraudFlagRate} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: '#1B1F27',
  border: '1px solid #2A2F3A',
  borderRadius: 10,
  fontSize: 12,
  color: '#E8EAED'
};
