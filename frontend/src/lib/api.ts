import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // send httpOnly cookies on every request
});

// Auto-refresh on 401 (skip for auth endpoints to avoid loops)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original.url?.includes("/api/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await api.post("/api/auth/refresh");
        return api(original);
      } catch {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
