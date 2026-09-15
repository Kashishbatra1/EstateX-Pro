import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBankAccount, updateBankAccount } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import BankForm from "../../components/banks/BankForm.jsx";
import {
  bankToFormValues,
  buildBankPayload,
  validateBankForm,
  mapApiFieldErrors,
} from "../../utils/bankHelpers.js";
import "../../styles/properties.css";

export default function BankEditPage() {
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
        const bank = await getBankAccount(id);
        if (cancelled) return;
        if (!bank) {
          setFormError("Bank account not found");
          setValues(null);
        } else {
          setValues(bankToFormValues(bank));
        }
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError
              ? err.message
              : "Failed to load bank account"
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
    const clientErrors = validateBankForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const bank = await updateBankAccount(id, buildBankPayload(values));
      navigate(`/banks/${bank.id}`, {
        replace: true,
        state: { flash: "Bank account updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not update bank account");
      } else {
        setFormError("Could not update bank account");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading bank account…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Bank account not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate("/banks")}
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
          <p className="page-toolbar__eyebrow">Banks</p>
          <h2 className="page-toolbar__title">Edit Bank Account</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <BankForm
        mode="edit"
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/banks/${id}`)}
      />
    </div>
  );
}
