import { useEffect, useState } from 'react';
import axios from 'axios';

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function ImpactCounter({ api, refreshKey }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${api}/impact`).then((r) => setD(r.data)).catch(() => {});
  }, [api, refreshKey]);
  if (!d || d.items === 0) return null;
  return (
    <div className="impact">
      <div className="cell"><div className="n">{d.items}</div><div className="l">items rerouted</div></div>
      <div className="cell"><div className="n">{inr(d.inrSaved)}</div><div className="l">value recovered</div></div>
      <div className="cell"><div className="n">{d.co2SavedKg.toFixed(1)} kg</div><div className="l">CO₂ avoided</div></div>
      <div className="cell"><div className="n">{d.greenCredits}</div><div className="l">credits issued</div></div>
    </div>
  );
}
