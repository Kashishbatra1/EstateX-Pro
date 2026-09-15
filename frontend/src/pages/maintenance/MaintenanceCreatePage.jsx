import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createMaintenance } from "../../api/maintenance.js";
import { listProperties } from "../../api/properties.js";
import { listEmployees } from "../../api/inventory.js";
import { listVendors } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import MaintenanceForm from "../../components/maintenance/MaintenanceForm.jsx";
import { LoadingState } from "../../components/ui/PageStates.jsx";
import {
  emptyMaintenanceForm,
  buildMaintenancePayload,
  formatApiError,
} from "../../utils/maintenanceHelpers.js";
import "../../styles/properties.css";

export default function MaintenanceCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetPropertyId = searchParams.get("propertyId") || "";
  const [values, setValues] = useState(() => ({
    ...emptyMaintenanceForm(),
    propertyId: presetPropertyId,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [properties, setProperties] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (presetPropertyId) {
      setValues((v) => ({ ...v, propertyId: presetPropertyId }));
    }
  }, [presetPropertyId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      listProperties({ limit: 100 }).catch(() => ({ items: [] })),
      listEmployees().catch(() => []),
      listVendors({ limit: 100 }).catch(() => ({ items: [] })),
    ])
      .then(([props, emps, vends]) => {
        if (cancelled) return;
        setProperties(props.items || []);
        setEmployees(Array.isArray(emps) ? emps : emps.items || []);
        setVendors(vends.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.propertyId) {
      setErrors({ propertyId: "Property is required" });
      return;
    }
    if (!values.title.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    if (!values.dueDate) {
      setErrors({ dueDate: "Due date is required" });
      return;
    }
    setSubmitting(true);
    try {
      const task = await createMaintenance(buildMaintenancePayload(values));
      navigate(`/maintenance/${task.id}`, { state: { flash: "Task created" } });
    } catch (err) {
      const details = err instanceof ApiError ? err.details || err.errors : null;
      if (Array.isArray(details)) {
        const fieldErrors = {};
        details.forEach((item) => {
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
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/maintenance" className="crumb">
              Maintenance
            </Link>
            <span aria-hidden="true"> / </span>
            New
          </p>
          <h2 className="page-toolbar__title">Add maintenance task</h2>
          <p className="muted tiny" style={{ marginTop: "0.35rem" }}>
            Link the task to a property, set a due date, and optionally assign staff or a vendor.
          </p>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      {loadingOptions ? (
        <LoadingState message="Loading form options…" />
      ) : (
        <MaintenanceForm
          values={values}
          errors={errors}
          submitting={submitting}
          properties={properties}
          employees={employees}
          vendors={vendors}
          onChange={setValues}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/maintenance")}
        />
      )}
    </div>
  );
}
