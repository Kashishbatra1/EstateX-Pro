import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getVendor, updateVendor } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import VendorForm from "../../components/vendors/VendorForm.jsx";
import {
  vendorToForm,
  buildVendorPayload,
  formatApiError,
} from "../../utils/vendorHelpers.js";
import "../../styles/properties.css";

export default function VendorEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getVendor(id)
      .then((v) => setValues(vendorToForm(v)))
      .catch((err) =>
        setFormError(err instanceof ApiError ? formatApiError(err) : "Load failed")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const vendor = await updateVendor(id, buildVendorPayload(values));
      navigate(`/vendors/${vendor.id}`, { state: { flash: "Vendor updated" } });
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
        <Link to="/vendors">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/vendors" className="crumb">
              Vendors
            </Link>
          </p>
          <h2 className="page-toolbar__title">Edit vendor</h2>
        </div>
      </div>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <VendorForm
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/vendors/${id}`)}
      />
    </div>
  );
}
