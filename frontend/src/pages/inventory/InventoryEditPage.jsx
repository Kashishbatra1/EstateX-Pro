import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getInventoryItem,
  updateInventoryItem,
} from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import InventoryForm from "../../components/inventory/InventoryForm.jsx";
import { formatApiError } from "../../utils/inventoryHelpers.js";
import "../../styles/properties.css";

export default function InventoryEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const item = await getInventoryItem(id);
        if (cancelled) return;
        setValues({
          itemName: item.itemName || "",
          itemType: item.itemType || "",
          quantity: String(item.quantity ?? 0),
          unit: item.unit || "pcs",
          status: item.status || "in_stock",
          purchaseDate: item.purchaseDate
            ? String(item.purchaseDate).slice(0, 10)
            : "",
          purchaseCost:
            item.purchaseCost != null ? String(item.purchaseCost) : "",
          locationNotes: item.locationNotes || "",
          notes: item.notes || "",
        });
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError ? formatApiError(err) : "Failed to load item"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!values) return;
    setFormError("");
    setErrors({});
    setSubmitting(true);
    try {
      const item = await updateInventoryItem(id, {
        itemName: values.itemName.trim(),
        itemType: values.itemType.trim() || null,
        quantity: Number(values.quantity),
        unit: values.unit.trim() || "pcs",
        status: values.status,
        purchaseDate: values.purchaseDate || null,
        purchaseCost:
          values.purchaseCost === "" ? null : Number(values.purchaseCost),
        locationNotes: values.locationNotes.trim() || null,
        notes: values.notes.trim() || null,
      });
      navigate(`/inventory/${item.id}`, {
        state: { flash: "Inventory item updated" },
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
        setFormError("Failed to update inventory item");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading item…</p>;
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        {formError || "Item not found"}
        <Link to="/inventory" className="btn btn--ghost">
          Back
        </Link>
      </div>
    );
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
          <h2 className="page-toolbar__title">Edit inventory item</h2>
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
        mode="edit"
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/inventory/${id}`)}
      />
    </div>
  );
}
