import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOwner, updateOwner } from "../../api/owners.js";
import { ApiError } from "../../api/client.js";
import OwnerForm from "../../components/owners/OwnerForm.jsx";
import {
  ownerToFormValues,
  buildOwnerPayload,
  validateOwnerForm,
  mapApiFieldErrors,
} from "../../utils/ownerHelpers.js";
import "../../styles/properties.css";

export default function OwnerEditPage() {
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
        const owner = await getOwner(id);
        if (cancelled) return;
        if (!owner) {
          setFormError("Owner not found");
          setValues(null);
        } else {
          setValues(ownerToFormValues(owner));
        }
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError ? err.message : "Failed to load owner"
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
    const clientErrors = validateOwnerForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const owner = await updateOwner(id, buildOwnerPayload(values));
      navigate(`/owners/${owner.id}`, {
        replace: true,
        state: { flash: "Owner updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not update owner");
      } else {
        setFormError("Could not update owner");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading owner…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Owner not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate("/owners")}
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
          <p className="page-toolbar__eyebrow">Owners</p>
          <h2 className="page-toolbar__title">Edit Owner</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <OwnerForm
        mode="edit"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/owners/${id}`)}
      />
    </div>
  );
}
