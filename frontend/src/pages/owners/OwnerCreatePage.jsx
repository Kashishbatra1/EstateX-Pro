import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOwner } from "../../api/owners.js";
import { ApiError } from "../../api/client.js";
import OwnerForm from "../../components/owners/OwnerForm.jsx";
import {
  emptyOwnerForm,
  buildOwnerPayload,
  validateOwnerForm,
  mapApiFieldErrors,
} from "../../utils/ownerHelpers.js";
import "../../styles/properties.css";

export default function OwnerCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyOwnerForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateOwnerForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const owner = await createOwner(buildOwnerPayload(values));
      navigate(`/owners/${owner.id}`, {
        replace: true,
        state: { flash: "Owner created" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not create owner");
      } else {
        setFormError("Could not create owner");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Owners</p>
          <h2 className="page-toolbar__title">Add Owner</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <OwnerForm
        mode="create"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/owners")}
      />
    </div>
  );
}
