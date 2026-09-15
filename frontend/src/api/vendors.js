import { apiRequest, apiUpload } from "./client.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listVendors(params = {}) {
  const result = await apiRequest(`/api/vendors${toQuery(params)}`);
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

export async function getVendor(id) {
  const result = await apiRequest(`/api/vendors/${id}`);
  return result.data?.vendor ?? null;
}

export async function createVendor(payload) {
  const result = await apiRequest("/api/vendors", {
    method: "POST",
    body: payload,
  });
  return result.data?.vendor ?? null;
}

export async function updateVendor(id, payload) {
  const result = await apiRequest(`/api/vendors/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.vendor ?? null;
}

export async function deleteVendor(id) {
  const result = await apiRequest(`/api/vendors/${id}`, {
    method: "DELETE",
  });
  return result.data?.vendor ?? null;
}

export async function addVendorPayment(vendorId, payload) {
  const result = await apiRequest(`/api/vendors/${vendorId}/payments`, {
    method: "POST",
    body: payload,
  });
  return result.data ?? null;
}

export async function addVendorDocument(vendorId, payload) {
  const result = await apiRequest(`/api/vendors/${vendorId}/documents`, {
    method: "POST",
    body: payload,
  });
  return result.data?.document ?? null;
}

export async function uploadVendorDocument(vendorId, formData) {
  const result = await apiUpload(
    `/api/vendors/${vendorId}/documents/upload`,
    formData
  );
  return result.data?.document ?? null;
}

export async function deleteVendorDocument(vendorId, documentId) {
  const result = await apiRequest(
    `/api/vendors/${vendorId}/documents/${documentId}`,
    { method: "DELETE" }
  );
  return result.data?.document ?? null;
}
