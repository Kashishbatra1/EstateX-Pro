import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBudget, updateBudget } from "../../api/budgets.js";
import { ApiError } from "../../api/client.js";
import BudgetForm from "../../components/budgets/BudgetForm.jsx";
import {
  budgetToForm,
  buildBudgetPayload,
  formatApiError,
} from "../../utils/budgetHelpers.js";
import "../../styles/properties.css";

export default function BudgetEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getBudget(id)
      .then((budget) => setValues(budgetToForm(budget)))
      .catch((err) =>
        setFormError(err instanceof ApiError ? formatApiError(err) : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    setSubmitting(true);
    try {
      await updateBudget(id, buildBudgetPayload(values));
      navigate(`/budgets/${id}`, { state: { flash: "Budget updated" } });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.errors)) {
        const fieldErrors = {};
        err.errors.forEach((item) => {
          if (item.field) fieldErrors[item.field] = item.message;
        });
        setErrors(fieldErrors);
      }
      setFormError(err instanceof ApiError ? formatApiError(err) : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!values) {
    return (
      <div className="properties-page">
        <div className="alert alert--error">{formError || "Budget not found"}</div>
        <Link to="/budgets">Back to budgets</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <p className="breadcrumb">
        <Link to="/budgets">Budgets</Link> / Edit
      </p>
      <h2 className="page-toolbar__title">Edit budget</h2>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <BudgetForm
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/budgets/${id}`)}
      />
    </div>
  );
}
