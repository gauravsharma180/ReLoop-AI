import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function ImpactCounter({ api, refreshKey }) {
  const { token } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${api}/impact`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setD(r.data))
      .catch(() => {});
  }, [api, refreshKey, token]);
  if (!d || d.itemsRerouted === 0) return null;
  return (
    <div className="impact">
      <div className="cell"><div className="n">{d.itemsRerouted}</div><div className="l">items rerouted</div></div>
      <div className="cell"><div className="n">{inr(d.valueRecovered)}</div><div className="l">value recovered</div></div>
      <div className="cell"><div className="n">{d.co2Avoided.toFixed(1)} kg</div><div className="l">CO₂ avoided</div></div>
      <div className="cell"><div className="n">{d.creditsIssued}</div><div className="l">credits issued</div></div>
    </div>
  );
}
