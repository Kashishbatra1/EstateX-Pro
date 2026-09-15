import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecurring } from "../../api/recurring.js";
import { listExpenses } from "../../api/expenses.js";
import { listVendors } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import RecurringForm from "../../components/recurring/RecurringForm.jsx";
import {
  emptyRecurringForm,
  buildRecurringPayload,
  formatApiError,
} from "../../utils/recurringHelpers.js";
import { collectLookupsFromExpenses } from "../../utils/expenseHelpers.js";
import "../../styles/properties.css";

export default function RecurringCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyRecurringForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    Promise.all([
      listExpenses({ limit: 50 }).catch(() => ({ items: [] })),
      listVendors({ limit: 50 }).catch(() => ({ items: [] })),
    ]).then(([expenseData, vendorData]) => {
      const lookups = collectLookupsFromExpenses(expenseData.items || []);
      setCategories(lookups.categories);
      setVendors(vendorData.items || []);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.title.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    if (values.amount === "" || Number.isNaN(Number(values.amount)) || Number(values.amount) < 0) {
      setErrors({ amount: "Amount must be a non-negative number" });
      return;
    }
    setSubmitting(true);
    try {
      const item = await createRecurring(buildRecurringPayload(values));
      navigate(`/recurring/${item.id}`, {
        state: { flash: "Recurring expense created" },
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? formatApiError(err) : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/recurring" className="crumb">
              Recurring
            </Link>
          </p>
          <h2 className="page-toolbar__title">Add recurring expense</h2>
        </div>
      </div>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <RecurringForm
        values={values}
        errors={errors}
        submitting={submitting}
        categories={categories}
        vendors={vendors}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/recurring")}
      />
    </div>
  );
}
