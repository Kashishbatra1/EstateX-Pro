import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMaintenance, updateMaintenance } from "../../api/maintenance.js";
import { listProperties } from "../../api/properties.js";
import { listEmployees } from "../../api/inventory.js";
import { listVendors } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import MaintenanceForm from "../../components/maintenance/MaintenanceForm.jsx";
import {
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import {
  taskToForm,
  buildMaintenancePayload,
  formatApiError,
} from "../../utils/maintenanceHelpers.js";
import "../../styles/properties.css";

export default function MaintenanceEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getMaintenance(id),
      listProperties({ limit: 100 }).catch(() => ({ items: [] })),
      listEmployees().catch(() => []),
      listVendors({ limit: 100 }).catch(() => ({ items: [] })),
    ])
      .then(([task, props, emps, vends]) => {
        if (cancelled) return;
        setValues(taskToForm(task));
        setProperties(props.items || []);
        setEmployees(Array.isArray(emps) ? emps : emps.items || []);
        setVendors(vends.items || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError ? formatApiError(err) : "Failed to load"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values?.title?.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    if (!values?.dueDate) {
      setErrors({ dueDate: "Due date is required" });
      return;
    }
    setSubmitting(true);
    try {
      await updateMaintenance(id, buildMaintenancePayload(values));
      navigate(`/maintenance/${id}`, { state: { flash: "Task updated" } });
    } catch (err) {
      const details = err instanceof ApiError ? err.details || err.errors : null;
      if (Array.isArray(details)) {
        const fieldErrors = {};
        details.forEach((item) => {
          if (item.field) fieldErrors[item.field] = item.message;
        });
        setErrors(fieldErrors);
      }
      setFormError(err instanceof ApiError ? formatApiError(err) : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading maintenance task…" />;
  }

  if (!values) {
    return (
      <div className="properties-page">
        <ErrorState message={formError || "Task not found"} />
        <Link to="/maintenance" className="btn btn--ghost btn--inline">
          Back to maintenance
        </Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/maintenance" className="crumb">
              Maintenance
            </Link>
            <span aria-hidden="true"> / </span>
            <Link to={`/maintenance/${id}`} className="crumb">
              #{id}
            </Link>
            <span aria-hidden="true"> / </span>
            Edit
          </p>
          <h2 className="page-toolbar__title">Edit maintenance task</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <MaintenanceForm
        values={values}
        errors={errors}
        submitting={submitting}
        properties={properties}
        employees={employees}
        vendors={vendors}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/maintenance/${id}`)}
      />
    </div>
  );
}
