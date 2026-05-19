// apps/web/src/lib/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api`,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// In production: add Clerk auth token to every request
// api.interceptors.request.use(async (config) => {
//   const token = await window.Clerk?.session?.getToken();
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.error || err.message;
    return Promise.reject(new Error(msg));
  }
);
