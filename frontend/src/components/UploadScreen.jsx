import { useState, useRef } from 'react';
import axios from 'axios';
import ResultCard from './ResultCard';
import ImpactCounter from './ImpactCounter';

const API = 'http://localhost:5000';

export default function UploadScreen() {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const data = new FormData();
      data.append('image', file);
      const res = await axios.post(`${API}/grade`, data);
      setResult(res.data);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Backend unreachable. Is it running on :5000?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="drop" onClick={() => fileRef.current?.click()}>
        {preview && <img className="preview" src={preview} alt="item to grade" />}
        <h2>{preview ? 'Grade another return' : 'Drop a returned item'}</h2>
        <p>Upload a photo. We grade condition, then route it: resell, refurbish, donate, or recycle.</p>
        <button className="btn" type="button">Choose photo</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
        {error && <div className="err">{error}</div>}
      </div>

      {loading && (
        <div className="scan"><span className="dot" /> Analyzing condition…</div>
      )}

      {result && !loading && <ResultCard r={result} />}

      <ImpactCounter api={API} refreshKey={tick} />
    </>
  );
}
