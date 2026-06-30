import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5000';

// Named "useLocation" per spec — note this shadows react-router-dom's own
// useLocation() hook. Don't import both in the same file without aliasing one.
export function useLocation() {
  const { token } = useAuth();
  const [locationStatus, setLocationStatus] = useState('idle');

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await axios.patch(
            `${API}/location`,
            { latitude, longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setLocationStatus('granted');
        } catch {
          setLocationStatus('error');
        }
      },
      (err) => {
        setLocationStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      }
    );
  }

  return { requestLocation, locationStatus };
}
