import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/api/v1/auth/refresh`,
            { refreshToken }
          );
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  register: (email: string, password: string, displayName?: string) =>
    api.post("/api/v1/auth/register", { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post("/api/v1/auth/login", { email, password }),
  logout: () => api.post("/api/v1/auth/logout"),
  me: () => api.get("/api/v1/me"),
  sendVerification: (email: string) =>
    api.post("/api/v1/auth/send-verification", { email }),
  verifyEmail: (email: string, code: string) =>
    api.post("/api/v1/auth/verify-email", { email, code }),
  forgotPassword: (email: string) =>
    api.post("/api/v1/auth/forgot-password", { email }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post("/api/v1/auth/reset-password", { email, token, newPassword }),
};

// Uploads
export const uploadApi = {
  init: (fileName: string, sizeBytes: number, contentType: string) =>
    api.post("/api/v1/uploads/init", { fileName, sizeBytes, contentType }),
  complete: (fileId: string, checksum?: string) =>
    api.post("/api/v1/uploads/complete", { fileId, checksum }),
};

// Jobs
export const jobsApi = {
  create: (fileId: string, preset: string, quality: string) =>
    api.post("/api/v1/jobs", { fileId, preset, quality }),
  list: (page = 1, pageSize = 20) =>
    api.get(`/api/v1/jobs?page=${page}&pageSize=${pageSize}`),
  get: (id: string) => api.get(`/api/v1/jobs/${id}`),
  cancel: (id: string) => api.post(`/api/v1/jobs/${id}/cancel`),
  download: (id: string, kind: "preview" | "master") =>
    api.get(`/api/v1/jobs/${id}/download?kind=${kind}`),
};

// Credits
export const creditsApi = {
  balance: () => api.get("/api/v1/credits/balance"),
  purchase: (creditAmount: number, successUrl: string, cancelUrl: string) =>
    api.post("/api/v1/credits/purchase", { creditAmount, successUrl, cancelUrl }),
};

// Analysis
export const analysisApi = {
  analyzeJob: (jobId: string, type: "input" | "output") =>
    api.get(`/api/v1/analysis/job/${jobId}?type=${type}`),
};
