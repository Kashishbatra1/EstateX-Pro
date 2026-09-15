import { apiRequest } from "./client.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listBookings(params = {}) {
  const result = await apiRequest(`/api/bookings${toQuery(params)}`);
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getBooking(id) {
  const result = await apiRequest(`/api/bookings/${id}`);
  return result.data?.booking ?? null;
}

export async function createBooking(payload) {
  const result = await apiRequest("/api/bookings", {
    method: "POST",
    body: payload,
  });
  return result.data?.booking ?? null;
}

export async function updateBooking(id, payload) {
  const result = await apiRequest(`/api/bookings/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.booking ?? null;
}

export async function updateBookingStatus(id, payload) {
  const result = await apiRequest(`/api/bookings/${id}/status`, {
    method: "PATCH",
    body: payload,
  });
  return result.data?.booking ?? null;
}

export async function cancelBooking(id, payload) {
  const result = await apiRequest(`/api/bookings/${id}/cancel`, {
    method: "POST",
    body: payload,
  });
  return result.data?.booking ?? null;
}

export async function completeBooking(id) {
  const result = await apiRequest(`/api/bookings/${id}/complete`, {
    method: "POST",
  });
  return result.data?.booking ?? null;
}

export async function deleteBooking(id) {
  const result = await apiRequest(`/api/bookings/${id}`, {
    method: "DELETE",
  });
  return result.data?.booking ?? null;
}
