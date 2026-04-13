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

    // Global error display for network/server errors
    if (!error.response) {
      // Network error — API unreachable
      const toast = (await import("react-hot-toast")).default;
      toast.error("Server unreachable. Check if API is running.");
    } else if (error.response.status >= 500) {
      const toast = (await import("react-hot-toast")).default;
      toast.error("Server error. Please try again.");
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
  create: (data: Record<string, any>) => api.post("/api/v1/jobs", data),
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

// Mix
export const mixApi = {
  createProject: (name: string) => api.post("/api/v1/mix/projects", { name }),
  listProjects: () => api.get("/api/v1/mix/projects"),
  getProject: (id: string) => api.get(`/api/v1/mix/projects/${id}`),
  addTrack: (projectId: string, fileId: string, name?: string) =>
    api.post(`/api/v1/mix/projects/${projectId}/tracks`, { fileId, name }),
  updateTrack: (projectId: string, trackId: string, data: any) =>
    api.put(`/api/v1/mix/projects/${projectId}/tracks/${trackId}`, data),
  deleteTrack: (projectId: string, trackId: string) =>
    api.delete(`/api/v1/mix/projects/${projectId}/tracks/${trackId}`),
  exportMixdown: (projectId: string) =>
    api.post(`/api/v1/mix/projects/${projectId}/export`),
  autoMix: (projectId: string) =>
    api.post(`/api/v1/mix/projects/${projectId}/auto-mix`),
  deleteProject: (projectId: string) =>
    api.delete(`/api/v1/mix/projects/${projectId}`),
  reorderTracks: (projectId: string, order: { trackId: string; index: number }[]) =>
    api.post(`/api/v1/mix/projects/${projectId}/reorder`, { order }),
  duplicateProject: (projectId: string) =>
    api.post(`/api/v1/mix/projects/${projectId}/duplicate`),
  eqPresets: () => api.get("/api/v1/mix/eq-presets"),
};

// Releases
export const releaseApi = {
  create: (data: any) => api.post("/api/v1/releases", data),
  list: () => api.get("/api/v1/releases"),
  get: (id: string) => api.get(`/api/v1/releases/${id}`),
  update: (id: string, data: any) => api.put(`/api/v1/releases/${id}`, data),
  uploadArtwork: (id: string) => api.post(`/api/v1/releases/${id}/artwork`),
  schedule: (id: string, releaseDate: string, distributor?: string) =>
    api.post(`/api/v1/releases/${id}/schedule`, { releaseDate, distributor }),
  submit: (id: string) => api.post(`/api/v1/releases/${id}/submit`),
};

// Recommendations
export const recommendApi = {
  mastering: (fileId: string) => api.post(`/api/v1/recommend/mastering/${fileId}`),
  mixing: (projectId: string) => api.post(`/api/v1/recommend/mixing/${projectId}`),
};

// Presets
export const presetsApi = {
  all: () => api.get("/api/v1/presets/all"),
  loudnessTargets: () => api.get("/api/v1/presets/loudness-targets"),
  processingChain: () => api.get("/api/v1/presets/processing-chain"),
};

// Admin
export const adminApi = {
  stats: () => api.get("/api/admin/jobs/stats"),
  users: (page?: number, search?: string) =>
    api.get(`/api/admin/users?page=${page || 1}&search=${search || ""}`),
  userDetail: (id: string) => api.get(`/api/admin/users/${id}`),
  addCredits: (id: string, amount: number) =>
    api.post(`/api/admin/users/${id}/credits`, { amount }),
  updatePlan: (id: string, plan: string) =>
    api.put(`/api/admin/users/${id}/plan`, { plan }),
  jobs: (page?: number, status?: string) =>
    api.get(`/api/admin/jobs?page=${page || 1}&status=${status || ""}`),
  retryJob: (id: string) => api.post(`/api/admin/jobs/${id}/retry`),
  cancelJob: (id: string) => api.post(`/api/admin/jobs/${id}/cancel`),
};
