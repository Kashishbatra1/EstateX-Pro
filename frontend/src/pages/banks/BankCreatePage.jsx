import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBankAccount } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import BankForm from "../../components/banks/BankForm.jsx";
import {
  emptyBankForm,
  buildBankPayload,
  validateBankForm,
  mapApiFieldErrors,
} from "../../utils/bankHelpers.js";
import "../../styles/properties.css";

export default function BankCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyBankForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateBankForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const bank = await createBankAccount(buildBankPayload(values));
      navigate(`/banks/${bank.id}`, {
        replace: true,
        state: { flash: "Bank account created" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not create bank account");
      } else {
        setFormError("Could not create bank account");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Banks</p>
          <h2 className="page-toolbar__title">Add Bank Account</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <BankForm
        mode="create"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/banks")}
      />
    </div>
  );
}
