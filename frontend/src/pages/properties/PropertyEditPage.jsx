import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProperty,
  updateProperty,
  listPaymentMethods,
} from "../../api/properties.js";
import { listBankAccounts } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import PropertyForm from "../../components/properties/PropertyForm.jsx";
import {
  propertyToFormValues,
  buildPropertyPayload,
  validatePropertyForm,
  mapApiFieldErrors,
} from "../../utils/propertyHelpers.js";
import { syncPrimaryOwnerBankAccount } from "../../utils/propertyBankSync.js";
import "../../styles/properties.css";

export default function PropertyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [linkedBanks, setLinkedBanks] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFormError("");
      try {
        const [property, methods, banksRes] = await Promise.all([
          getProperty(id),
          listPaymentMethods().catch(() => []),
          listBankAccounts({ limit: 100, isActive: "true" }).catch(() => ({
            items: [],
          })),
        ]);
        if (cancelled) return;
        if (!property) {
          setFormError("Property not found");
          setValues(null);
          setLinkedBanks([]);
        } else {
          setValues(propertyToFormValues(property));
          setLinkedBanks(property.bankAccounts || []);
          setPaymentMethods(methods);
          setBankAccounts(banksRes.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError ? err.message : "Failed to load property"
          );
          setValues(null);
          setLinkedBanks([]);
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
    const clientErrors = validatePropertyForm(values, { mode: "edit" });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const property = await updateProperty(id, buildPropertyPayload(values));
      try {
        await syncPrimaryOwnerBankAccount(
          property.id,
          values.primaryBankAccountId,
          linkedBanks
        );
      } catch {
        navigate(`/properties/${property.id}`, {
          replace: true,
          state: {
            flash:
              "Property updated, but owner bank account could not be synced. Check bank links on property details.",
          },
        });
        return;
      }
      navigate(`/properties/${property.id}`, {
        replace: true,
        state: { flash: "Property updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not update property");
      } else {
        setFormError("Could not update property");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading property…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Property not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate("/properties")}
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
          <p className="page-toolbar__eyebrow">Properties</p>
          <h2 className="page-toolbar__title">Edit Property</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <PropertyForm
        mode="edit"
        values={values}
        errors={errors}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/properties/${id}`)}
      />
    </div>
  );
}
