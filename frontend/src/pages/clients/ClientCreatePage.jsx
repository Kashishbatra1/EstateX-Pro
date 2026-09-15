import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import ClientForm from "../../components/clients/ClientForm.jsx";
import {
  emptyClientForm,
  buildClientPayload,
  validateClientForm,
  mapApiFieldErrors,
} from "../../utils/clientHelpers.js";
import "../../styles/properties.css";

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyClientForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateClientForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const client = await createClient(buildClientPayload(values));
      navigate(`/clients/${client.id}`, {
        replace: true,
        state: { flash: "Client created" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not create client");
      } else {
        setFormError("Could not create client");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Clients</p>
          <h2 className="page-toolbar__title">Add Client</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <ClientForm
        mode="create"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/clients")}
      />
    </div>
  );
}
