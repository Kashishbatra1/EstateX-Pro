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

export async function listProperties(params = {}) {
  const result = await apiRequest(`/api/properties${toQuery(params)}`);
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

export async function getProperty(id) {
  const result = await apiRequest(`/api/properties/${id}`);
  return result.data?.property ?? null;
}

export async function createProperty(payload) {
  const result = await apiRequest("/api/properties", {
    method: "POST",
    body: payload,
  });
  return result.data?.property ?? null;
}

export async function updateProperty(id, payload) {
  const result = await apiRequest(`/api/properties/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.property ?? null;
}

export async function updatePropertyStatus(id, status) {
  const result = await apiRequest(`/api/properties/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
  return result.data?.property ?? null;
}

export async function deleteProperty(id) {
  const result = await apiRequest(`/api/properties/${id}`, {
    method: "DELETE",
  });
  return result.data?.property ?? null;
}

export async function listPaymentMethods() {
  const result = await apiRequest("/api/payment-methods");
  const data = result.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.paymentMethods)) return data.paymentMethods;
  return [];
}

export async function linkPropertyOwner(propertyId, payload) {
  const result = await apiRequest(`/api/properties/${propertyId}/owners`, {
    method: "POST",
    body: payload,
  });
  return result.data?.link ?? null;
}

export async function updatePropertyOwnerLink(propertyId, ownerId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/owners/${ownerId}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
  return result.data?.link ?? null;
}

export async function unlinkPropertyOwner(propertyId, ownerId) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/owners/${ownerId}`,
    { method: "DELETE" }
  );
  return result.data ?? null;
}

export async function linkPropertyBank(propertyId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/bank-accounts`,
    {
      method: "POST",
      body: payload,
    }
  );
  return result.data?.link ?? null;
}

export async function updatePropertyBankLink(propertyId, bankAccountId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/bank-accounts/${bankAccountId}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
  return result.data?.link ?? null;
}

export async function unlinkPropertyBank(propertyId, bankAccountId) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/bank-accounts/${bankAccountId}`,
    { method: "DELETE" }
  );
  return result.data ?? null;
}

export async function listPropertyHistory(propertyId, params = {}) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/history${toQuery(params)}`
  );
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function listPropertyDocuments(propertyId, params = {}) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/documents${toQuery(params)}`
  );
  return result.data?.items ?? [];
}

export async function createPropertyDocument(propertyId, payload) {
  const result = await apiRequest(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    body: payload,
  });
  return result.data?.document ?? null;
}

export async function uploadPropertyDocument(propertyId, formData) {
  const result = await apiUpload(
    `/api/properties/${propertyId}/documents/upload`,
    formData
  );
  return result.data?.document ?? null;
}

export async function updatePropertyDocument(propertyId, documentId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/documents/${documentId}`,
    { method: "PUT", body: payload }
  );
  return result.data?.document ?? null;
}

export async function deletePropertyDocument(propertyId, documentId) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/documents/${documentId}`,
    { method: "DELETE" }
  );
  return result.data?.document ?? null;
}

export async function listPropertyMedia(propertyId, params = {}) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/media${toQuery(params)}`
  );
  return result.data?.items ?? [];
}

export async function createPropertyMedia(propertyId, payload) {
  const result = await apiRequest(`/api/properties/${propertyId}/media`, {
    method: "POST",
    body: payload,
  });
  return result.data?.media ?? null;
}

export async function uploadPropertyMedia(propertyId, formData) {
  const result = await apiUpload(
    `/api/properties/${propertyId}/media/upload`,
    formData
  );
  return result.data?.media ?? null;
}

export async function updatePropertyMedia(propertyId, mediaId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/media/${mediaId}`,
    { method: "PUT", body: payload }
  );
  return result.data?.media ?? null;
}

export async function deletePropertyMedia(propertyId, mediaId) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/media/${mediaId}`,
    { method: "DELETE" }
  );
  return result.data?.media ?? null;
}

export async function listPropertyVisits(propertyId) {
  const result = await apiRequest(`/api/properties/${propertyId}/visits`);
  return result.data?.items ?? [];
}

export async function createPropertyVisit(propertyId, payload) {
  const result = await apiRequest(`/api/properties/${propertyId}/visits`, {
    method: "POST",
    body: payload,
  });
  return result.data?.visit ?? null;
}

export async function updatePropertyVisit(propertyId, visitId, payload) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/visits/${visitId}`,
    { method: "PUT", body: payload }
  );
  return result.data?.visit ?? null;
}

export async function deletePropertyVisit(propertyId, visitId) {
  const result = await apiRequest(
    `/api/properties/${propertyId}/visits/${visitId}`,
    { method: "DELETE" }
  );
  return result.data?.visit ?? null;
}
