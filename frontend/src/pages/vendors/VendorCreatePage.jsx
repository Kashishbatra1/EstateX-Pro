import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createVendor } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import VendorForm from "../../components/vendors/VendorForm.jsx";
import {
  emptyVendorForm,
  buildVendorPayload,
  formatApiError,
} from "../../utils/vendorHelpers.js";
import "../../styles/properties.css";

export default function VendorCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyVendorForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.vendorName.trim()) {
      setErrors({ vendorName: "Vendor name is required" });
      return;
    }
    setSubmitting(true);
    try {
      const vendor = await createVendor(buildVendorPayload(values));
      navigate(`/vendors/${vendor.id}`, { state: { flash: "Vendor created" } });
    } catch (err) {
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
            <Link to="/vendors" className="crumb">
              Vendors
            </Link>
          </p>
          <h2 className="page-toolbar__title">Add vendor</h2>
        </div>
      </div>
      {formError ? <div className="alert alert--error">{formError}</div> : null}
      <VendorForm
        values={values}
        errors={errors}
        submitting={submitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/vendors")}
      />
    </div>
  );
}
