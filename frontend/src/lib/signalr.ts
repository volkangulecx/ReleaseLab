import * as signalR from "@microsoft/signalr";
import toast from "react-hot-toast";

let connection: signalR.HubConnection | null = null;

export function getConnection(): signalR.HubConnection | null {
  return connection;
}

export function startConnection(onJobCompleted?: (data: { jobId: string; preset: string; message: string }) => void) {
  if (connection?.state === signalR.HubConnectionState.Connected) return;

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!token) return;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/hubs/jobs`, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on("JobProgress", (data: { jobId: string; progress: number; stage: string }) => {
    // Dispatch custom event for components to listen
    window.dispatchEvent(new CustomEvent("job:progress", { detail: data }));
  });

  connection.on("JobCompleted", (data: { jobId: string; preset: string; message: string }) => {
    toast.success(data.message);
    window.dispatchEvent(new CustomEvent("job:completed", { detail: data }));
    onJobCompleted?.(data);
  });

  connection.on("JobFailed", (data: { jobId: string; errorMessage: string }) => {
    toast.error(`Mastering failed: ${data.errorMessage || "Unknown error"}`);
    window.dispatchEvent(new CustomEvent("job:failed", { detail: data }));
  });

  connection.start().catch((err) => {
    console.warn("SignalR connection failed, falling back to polling:", err);
  });
}

export function stopConnection() {
  connection?.stop();
  connection = null;
}
