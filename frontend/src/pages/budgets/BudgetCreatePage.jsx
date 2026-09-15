import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createBudget } from "../../api/budgets.js";
import { ApiError } from "../../api/client.js";
import BudgetForm from "../../components/budgets/BudgetForm.jsx";
import {
  emptyBudgetForm,
  buildBudgetPayload,
  formatApiError,
} from "../../utils/budgetHelpers.js";
import "../../styles/properties.css";

export default function BudgetCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyBudgetForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    if (!values.totalAmount && values.totalAmount !== 0) {
      setErrors({ totalAmount: "Total amount is required" });
      return;
    }
    setSubmitting(true);
    try {
      const budget = await createBudget(buildBudgetPayload(values));
      navigate(`/budgets/${budget.id}`, {
        state: { flash: "Budget created" },
      });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.errors)) {
        const fieldErrors = {};
        err.errors.forEach((e) => {
          if (e.field) fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
      setFormError(err instanceof ApiError ? formatApiError(err) : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <p className="breadcrumb">
        <Link to="/budgets">Budgets</Link> / New
      </p>
      <h2 className="page-toolbar__title">Add budget</h2>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <BudgetForm
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/budgets")}
      />
    </div>
  );
}
