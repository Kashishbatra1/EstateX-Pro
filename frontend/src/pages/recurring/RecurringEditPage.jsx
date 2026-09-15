import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRecurring, updateRecurring } from "../../api/recurring.js";
import { listExpenses } from "../../api/expenses.js";
import { listVendors } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import RecurringForm from "../../components/recurring/RecurringForm.jsx";
import {
  recurringToForm,
  buildRecurringPayload,
  formatApiError,
} from "../../utils/recurringHelpers.js";
import { collectLookupsFromExpenses } from "../../utils/expenseHelpers.js";
import "../../styles/properties.css";

export default function RecurringEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    Promise.all([
      getRecurring(id),
      listExpenses({ limit: 50 }).catch(() => ({ items: [] })),
      listVendors({ limit: 50 }).catch(() => ({ items: [] })),
    ])
      .then(([item, expenseData, vendorData]) => {
        setValues(recurringToForm(item));
        const lookups = collectLookupsFromExpenses(expenseData.items || []);
        if (item?.categoryId && item?.categoryName) {
          lookups.categories.push({
            id: item.categoryId,
            name: item.categoryName,
          });
        }
        setCategories(
          Array.from(new Map(lookups.categories.map((c) => [c.id, c])).values())
        );
        setVendors(vendorData.items || []);
      })
      .catch((err) =>
        setFormError(err instanceof ApiError ? formatApiError(err) : "Load failed")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setErrors({});
    if (!values.title.trim()) {
      setErrors({ title: "Title is required" });
      setSubmitting(false);
      return;
    }
    try {
      const item = await updateRecurring(id, buildRecurringPayload(values));
      navigate(`/recurring/${item.id}`, {
        state: { flash: "Recurring expense updated" },
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? formatApiError(err) : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!values) {
    return (
      <div className="state-panel state-panel--error">
        {formError || "Not found"}
        <Link to="/recurring">Back</Link>
      </div>
    );
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
          <h2 className="page-toolbar__title">Edit recurring expense</h2>
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
        onCancel={() => navigate(`/recurring/${id}`)}
      />
    </div>
  );
}
