import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProperty,
  listPaymentMethods,
} from "../../api/properties.js";
import { listBankAccounts } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import PropertyForm from "../../components/properties/PropertyForm.jsx";
import {
  emptyPropertyForm,
  buildPropertyPayload,
  validatePropertyForm,
  mapApiFieldErrors,
} from "../../utils/propertyHelpers.js";
import { syncPrimaryOwnerBankAccount } from "../../utils/propertyBankSync.js";
import "../../styles/properties.css";

export default function PropertyCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyPropertyForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPaymentMethods().catch(() => []),
      listBankAccounts({ limit: 100, isActive: "true" }).catch(() => ({
        items: [],
      })),
    ]).then(([methods, banksRes]) => {
      if (cancelled) return;
      setPaymentMethods(methods);
      setBankAccounts(banksRes.items || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validatePropertyForm(values, { mode: "create" });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const property = await createProperty(buildPropertyPayload(values));
      try {
        await syncPrimaryOwnerBankAccount(
          property.id,
          values.primaryBankAccountId,
          []
        );
      } catch {
        navigate(`/properties/${property.id}`, {
          replace: true,
          state: {
            flash:
              "Property created as draft, but owner bank account could not be linked. Link it from property details.",
          },
        });
        return;
      }
      navigate(`/properties/${property.id}`, {
        replace: true,
        state: { flash: "Property created as draft" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(err.message || "Could not create property");
      } else {
        setFormError("Could not create property");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Properties</p>
          <h2 className="page-toolbar__title">Add Property</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <PropertyForm
        mode="create"
        values={values}
        errors={errors}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/properties")}
      />
    </div>
  );
}
