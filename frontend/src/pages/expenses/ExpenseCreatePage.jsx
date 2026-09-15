import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExpense, listExpenses } from "../../api/expenses.js";
import { listProperties, listPaymentMethods } from "../../api/properties.js";
import { listVendors } from "../../api/vendors.js";
import { listEmployees } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import ExpenseForm from "../../components/expenses/ExpenseForm.jsx";
import {
  emptyExpenseForm,
  buildExpensePayload,
  validateExpenseForm,
  mapApiFieldErrors,
  formatApiError,
  collectLookupsFromExpenses,
} from "../../utils/expenseHelpers.js";
import "../../styles/properties.css";

export default function ExpenseCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyExpenseForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [propsRes, methodsRes, expensesRes, employeesRes, vendorsRes] =
          await Promise.all([
            listProperties({ limit: 100 }),
            listPaymentMethods(),
            listExpenses({ limit: 100 }),
            listEmployees(),
            listVendors({ limit: 100 }),
          ]);
        if (cancelled) return;
        setProperties(propsRes.items || []);
        setPaymentMethods(
          (methodsRes || []).filter((m) => m.isActive !== false)
        );
        const lookups = collectLookupsFromExpenses(expensesRes.items || []);
        setCategories(lookups.categories);
        const empMap = new Map(
          (employeesRes || []).map((e) => [
            e.id,
            { id: e.id, name: e.fullName },
          ])
        );
        lookups.employees.forEach((e) => {
          if (!empMap.has(e.id)) empMap.set(e.id, e);
        });
        setEmployees(Array.from(empMap.values()));
        setVendors(vendorsRes.items || []);
      } catch {
        if (!cancelled) {
          setFormError("Failed to load some related options");
        }
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateExpenseForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const expense = await createExpense(buildExpensePayload(values));
      navigate(`/expenses/${expense.id}`, {
        replace: true,
        state: { flash: "Expense created as requested" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not create expense");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Expenses</p>
          <h2 className="page-toolbar__title">Add Expense</h2>
        </div>
      </div>
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      <ExpenseForm
        mode="create"
        values={values}
        errors={errors}
        submitting={submitting}
        categories={categories}
        employees={employees}
        vendors={vendors}
        properties={properties}
        paymentMethods={paymentMethods}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/expenses")}
      />
    </div>
  );
}
