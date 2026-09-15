import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPettyCash } from "../../api/pettyCash.js";
import { listEmployees } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import PettyCashForm from "../../components/pettyCash/PettyCashForm.jsx";
import {
  emptyPettyForm,
  buildPettyPayload,
  formatApiError,
} from "../../utils/pettyCashHelpers.js";
import "../../styles/properties.css";

export default function PettyCashCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyPettyForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    listEmployees()
      .then((items) => setEmployees(Array.isArray(items) ? items : items.items || []))
      .catch(() => setEmployees([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.accountName.trim()) {
      setErrors({ accountName: "Account name is required" });
      return;
    }
    if (!values.custodianEmployeeId) {
      setErrors({ custodianEmployeeId: "Custodian is required" });
      return;
    }
    setSubmitting(true);
    try {
      const account = await createPettyCash(buildPettyPayload(values));
      navigate(`/petty-cash/${account.id}`, { state: { flash: "Account created" } });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.errors)) {
        const fieldErrors = {};
        err.errors.forEach((item) => {
          if (item.field) fieldErrors[item.field] = item.message;
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
        <Link to="/petty-cash">Petty Cash</Link> / New
      </p>
      <h2 className="page-toolbar__title">Add petty cash account</h2>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <PettyCashForm
        values={values}
        errors={errors}
        submitting={submitting}
        employees={employees}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/petty-cash")}
      />
    </div>
  );
}
