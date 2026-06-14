import axios from 'axios';
const BASE = 'http://localhost:5000';
export async function gradeItem(file) {
  const data = new FormData();
  data.append('image', file);
  const { data: res } = await axios.post(`${BASE}/grade`, data);
  return res;
}
export async function getImpact() {
  const { data } = await axios.get(`${BASE}/impact`);
  return data;
}
export async function predictReturn(signals) {
  const { data } = await axios.post(`${BASE}/predict-return`, signals);
  return data;
}
