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

export async function listClients(params = {}) {
  const result = await apiRequest(`/api/clients${toQuery(params)}`);
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

export async function getClient(id) {
  const result = await apiRequest(`/api/clients/${id}`);
  return result.data?.client ?? null;
}

export async function createClient(payload) {
  const result = await apiRequest("/api/clients", {
    method: "POST",
    body: payload,
  });
  return result.data?.client ?? null;
}

export async function updateClient(id, payload) {
  const result = await apiRequest(`/api/clients/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.client ?? null;
}

export async function updateClientNotes(id, crmNotes) {
  const result = await apiRequest(`/api/clients/${id}/notes`, {
    method: "PATCH",
    body: { crmNotes },
  });
  return result.data?.client ?? null;
}

export async function updateClientFollowUp(id, nextFollowUpDate) {
  const result = await apiRequest(`/api/clients/${id}/follow-up`, {
    method: "PATCH",
    body: { nextFollowUpDate },
  });
  return result.data?.client ?? null;
}

export async function deleteClient(id) {
  const result = await apiRequest(`/api/clients/${id}`, {
    method: "DELETE",
  });
  return result.data?.client ?? null;
}

export async function listClientCommunications(id) {
  const result = await apiRequest(`/api/clients/${id}/communications`);
  return result.data?.items ?? [];
}

export async function addClientCommunication(id, payload) {
  const result = await apiRequest(`/api/clients/${id}/communications`, {
    method: "POST",
    body: payload,
  });
  return result.data?.communication ?? result.data ?? null;
}

export async function listClientKycDocuments(id) {
  const result = await apiRequest(`/api/clients/${id}/kyc-documents`);
  return result.data?.items ?? [];
}

export async function addClientKycDocument(id, payload) {
  const result = await apiRequest(`/api/clients/${id}/kyc-documents`, {
    method: "POST",
    body: payload,
  });
  return result.data?.document ?? null;
}

export async function uploadClientKycDocument(id, formData) {
  const result = await apiUpload(
    `/api/clients/${id}/kyc-documents/upload`,
    formData
  );
  return result.data?.document ?? null;
}

export async function deleteClientKycDocument(clientId, documentId) {
  const result = await apiRequest(
    `/api/clients/${clientId}/kyc-documents/${documentId}`,
    { method: "DELETE" }
  );
  return result.data?.document ?? null;
}
