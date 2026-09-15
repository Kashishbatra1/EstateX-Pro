import { apiRequest } from "./client.js";

export async function fetchDashboard() {
  const result = await apiRequest("/api/dashboard");
  return result.data?.dashboard ?? null;
}
