import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createInventoryItem } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import InventoryForm from "../../components/inventory/InventoryForm.jsx";
import { formatApiError } from "../../utils/inventoryHelpers.js";
import "../../styles/properties.css";

const empty = {
  itemName: "",
  itemType: "Device",
  quantity: "1",
  unit: "pcs",
  purchaseDate: "",
  purchaseCost: "",
  locationNotes: "",
  notes: "",
};

export default function InventoryCreatePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    if (!values.itemName.trim()) {
      setErrors({ itemName: "Item name is required" });
      return;
    }
    setSubmitting(true);
    try {
      const item = await createInventoryItem({
        itemName: values.itemName.trim(),
        itemType: values.itemType.trim() || null,
        quantity: Number(values.quantity) || 0,
        unit: values.unit.trim() || "pcs",
        purchaseDate: values.purchaseDate || null,
        purchaseCost:
          values.purchaseCost === "" ? null : Number(values.purchaseCost),
        locationNotes: values.locationNotes.trim() || null,
        notes: values.notes.trim() || null,
      });
      navigate(`/inventory/${item.id}`, {
        state: { flash: "Inventory item created" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = {};
        (err.details || []).forEach((d) => {
          if (d.field) fieldErrors[d.field] = d.message;
        });
        setErrors(fieldErrors);
        setFormError(formatApiError(err));
      } else {
        setFormError("Failed to create inventory item");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/inventory" className="crumb">
              Inventory
            </Link>
          </p>
          <h2 className="page-toolbar__title">Add inventory item</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <InventoryForm
        values={values}
        errors={errors}
        submitting={submitting}
        mode="create"
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/inventory")}
      />
    </div>
  );
}
