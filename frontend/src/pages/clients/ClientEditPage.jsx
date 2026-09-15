import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getClient, updateClient } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import ClientForm from "../../components/clients/ClientForm.jsx";
import {
  clientToFormValues,
  buildClientPayload,
  validateClientForm,
  mapApiFieldErrors,
} from "../../utils/clientHelpers.js";
import "../../styles/properties.css";

export default function ClientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const client = await getClient(id);
        if (cancelled) return;
        if (!client) {
          setFormError("Client not found");
          setValues(null);
        } else {
          setValues(clientToFormValues(client));
        }
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError ? err.message : "Failed to load client"
          );
          setValues(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values) return;
    setFormError("");
    const clientErrors = validateClientForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const client = await updateClient(id, buildClientPayload(values));
      navigate(`/clients/${client.id}`, {
        replace: true,
        state: { flash: "Client updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not update client");
      } else {
        setFormError("Could not update client");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading client…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Client not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate("/clients")}
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Clients</p>
          <h2 className="page-toolbar__title">Edit Client</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <ClientForm
        mode="edit"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/clients/${id}`)}
      />
    </div>
  );
}
