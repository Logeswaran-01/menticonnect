const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const API_BASE = base.endsWith('/api') ? base : `${base}/api`;

export default API_BASE;
