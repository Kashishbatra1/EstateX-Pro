import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getExpense,
  updateExpense,
  listExpenses,
} from "../../api/expenses.js";
import { listProperties, listPaymentMethods } from "../../api/properties.js";
import { listEmployees } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import ExpenseForm from "../../components/expenses/ExpenseForm.jsx";
import {
  expenseToForm,
  buildExpensePayload,
  validateExpenseForm,
  mapApiFieldErrors,
  formatApiError,
  canEditExpense,
  collectLookupsFromExpenses,
} from "../../utils/expenseHelpers.js";
import "../../styles/properties.css";

export default function ExpenseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expenseMeta, setExpenseMeta] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [properties, setProperties] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [expense, propsRes, methodsRes, expensesRes, employeesRes] =
          await Promise.all([
            getExpense(id),
            listProperties({ limit: 100 }),
            listPaymentMethods(),
            listExpenses({ limit: 100 }),
            listEmployees(),
          ]);
        if (cancelled) return;
        setProperties(propsRes.items || []);
        setPaymentMethods(
          (methodsRes || []).filter((m) => m.isActive !== false)
        );
        const lookups = collectLookupsFromExpenses(expensesRes.items || []);
        if (expense?.categoryId) {
          lookups.categories.push({
            id: expense.categoryId,
            name: expense.categoryName || `Category #${expense.categoryId}`,
          });
        }
        (employeesRes || []).forEach((e) => {
          lookups.employees.push({
            id: e.id,
            name: e.fullName,
          });
        });
        if (expense?.paidByEmployeeId) {
          lookups.employees.push({
            id: expense.paidByEmployeeId,
            name:
              expense.paidByEmployeeName ||
              `Employee #${expense.paidByEmployeeId}`,
          });
        }
        setCategories(
          Array.from(
            new Map(lookups.categories.map((c) => [c.id, c])).values()
          )
        );
        setEmployees(
          Array.from(
            new Map(lookups.employees.map((e) => [e.id, e])).values()
          )
        );

        if (!expense) {
          setFormError("Expense not found");
          setValues(null);
          return;
        }
        if (!canEditExpense(expense.approvalStatus)) {
          setFormError(
            `Cannot edit a ${expense.approvalStatus} expense. Only requested expenses can be updated.`
          );
          setExpenseMeta(expense);
          setValues(null);
          return;
        }
        setExpenseMeta(expense);
        setValues(expenseToForm(expense));
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load expense"
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
    const clientErrors = validateExpenseForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const expense = await updateExpense(id, buildExpensePayload(values));
      navigate(`/expenses/${expense.id}`, {
        replace: true,
        state: { flash: "Expense updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not update expense");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading expense…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Expense not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            navigate(expenseMeta ? `/expenses/${id}` : "/expenses")
          }
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Expenses</p>
          <h2 className="page-toolbar__title">
            Edit {expenseMeta?.expenseCode || "Expense"}
          </h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <ExpenseForm
        mode="edit"
        values={values}
        errors={errors}
        submitting={submitting}
        categories={categories}
        employees={employees}
        properties={properties}
        paymentMethods={paymentMethods}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/expenses/${id}`)}
      />
    </div>
  );
}
