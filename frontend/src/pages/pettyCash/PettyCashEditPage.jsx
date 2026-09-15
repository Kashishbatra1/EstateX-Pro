import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPettyCash, updatePettyCash } from "../../api/pettyCash.js";
import { listEmployees } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import PettyCashForm from "../../components/pettyCash/PettyCashForm.jsx";
import {
  accountToForm,
  buildPettyPayload,
  formatApiError,
} from "../../utils/pettyCashHelpers.js";
import "../../styles/properties.css";

export default function PettyCashEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    Promise.all([
      getPettyCash(id),
      listEmployees().catch(() => ({ items: [] })),
    ])
      .then(([account, empData]) => {
        setValues(accountToForm(account));
        setEmployees(Array.isArray(empData) ? empData : empData.items || []);
      })
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
      await updatePettyCash(id, buildPettyPayload(values, { includeActive: true }));
      navigate(`/petty-cash/${id}`, { state: { flash: "Account updated" } });
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
        <div className="alert alert--error">{formError || "Account not found"}</div>
        <Link to="/petty-cash">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <p className="breadcrumb">
        <Link to="/petty-cash">Petty Cash</Link> / Edit
      </p>
      <h2 className="page-toolbar__title">Edit petty cash account</h2>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <PettyCashForm
        values={values}
        errors={errors}
        submitting={submitting}
        employees={employees}
        showActive
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/petty-cash/${id}`)}
      />
    </div>
  );
}
