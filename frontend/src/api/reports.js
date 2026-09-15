import {

  apiRequest,

  ApiError,

  getApiBaseUrl,

  getStoredToken,

  clearStoredSession,

} from "./client.js";



function toQuery(params = {}) {

  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {

    if (value === undefined || value === null || value === "") return;

    search.set(key, String(value));

  });

  const qs = search.toString();

  return qs ? `?${qs}` : "";

}



async function fetchReport(path, params = {}) {

  const result = await apiRequest(`${path}${toQuery(params)}`);

  return {

    summary: result.data?.summary ?? null,

    items: result.data?.items ?? [],

    pagination: result.data?.pagination ?? {

      page: 1,

      limit: 20,

      total: 0,

      totalPages: 0,

    },

  };

}



function filenameFromDisposition(header, fallback) {

  if (!header) return fallback;

  const match = /filename="?([^";]+)"?/i.exec(header);

  return match?.[1] || fallback;

}



/**

 * Download a report as CSV or PDF (format=csv|pdf).

 * Uses fetch directly because the response is a file, not the JSON envelope.

 */

export async function downloadReport(path, params = {}) {

  const token = getStoredToken();

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}${toQuery(params)}`;



  let response;

  try {

    response = await fetch(url, {

      method: "GET",

      headers: {

        Accept: "*/*",

        ...(token ? { Authorization: `Bearer ${token}` } : {}),

      },

    });

  } catch {

    throw new ApiError(

      "Unable to reach the server. Check that the backend is running."

    );

  }



  if (response.status === 401) {
    clearStoredSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("estatex:unauthorized"));
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    throw new ApiError("Authentication required", { status: 401 });
  }

  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok || contentType.includes("application/json")) {

    let payload = null;

    try {

      payload = await response.json();

    } catch {

      payload = null;

    }

    throw new ApiError(

      payload?.message || `Export failed (${response.status})`,

      {

        status: response.status,

        details: payload?.details,

      }

    );

  }



  const blob = await response.blob();

  const fallback =

    params.format === "pdf" ? "estatex-report.pdf" : "estatex-report.csv";

  const filename = filenameFromDisposition(

    response.headers.get("Content-Disposition"),

    fallback

  );



  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = objectUrl;

  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(objectUrl);



  return { filename };

}



export function fetchBookingsReport(params = {}) {

  return fetchReport("/api/reports/bookings", params);

}



export function fetchPaymentsReport(params = {}) {

  return fetchReport("/api/reports/payments", params);

}



export function fetchExpensesReport(params = {}) {

  return fetchReport("/api/reports/expenses", params);

}



export function fetchPropertiesReport(params = {}) {

  return fetchReport("/api/reports/properties", params);

}



export function downloadBookingsReport(params = {}) {

  return downloadReport("/api/reports/bookings", params);

}



export function downloadPaymentsReport(params = {}) {

  return downloadReport("/api/reports/payments", params);

}



export function downloadExpensesReport(params = {}) {

  return downloadReport("/api/reports/expenses", params);

}



export function downloadPropertiesReport(params = {}) {

  return downloadReport("/api/reports/properties", params);

}


