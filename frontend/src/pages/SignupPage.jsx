import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerRequest } from "../api/auth.js";
import { ApiError } from "../api/client.js";
import "../styles/login.css";

export default function SignupPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};
    const name = fullName.trim();
    const trimmedEmail = email.trim();

    if (!name) next.fullName = "Full name is required";
    if (!trimmedEmail) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Email format is invalid";
    }
    if (!role || !["admin", "super_admin"].includes(role)) {
      next.role = "Select Super Admin or Admin";
    }
    if (!password) next.password = "Password is required";
    else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }
    if (!confirmPassword) next.confirmPassword = "Confirm password is required";
    else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await registerRequest({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      navigate("/login", {
        replace: true,
        state: {
          flash: "Account created. Sign in with your new credentials.",
        },
      });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const mapped = {};
        for (const item of err.details) {
          if (item?.field) mapped[item.field] = item.message;
        }
        if (Object.keys(mapped).length) setFieldErrors(mapped);
      }
      setFormError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="login-panel">
        <header className="login-brand">
          <span className="login-brand__mark" />
          <h1 className="login-brand__name">EstateX Pro</h1>
          <p className="login-brand__tagline">
            Smart property inventory and office expense management.
          </p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h2 className="login-form__title">Create account</h2>

          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <label className="field">
            <span className="field__label">Full name</span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
            {fieldErrors.fullName ? (
              <span className="field__error">{fieldErrors.fullName}</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <span className="field__error">{fieldErrors.email}</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">Role *</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.role)}
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
            </select>
            {fieldErrors.role ? (
              <span className="field__error">{fieldErrors.role}</span>
            ) : null}
          </label>

          <div className="field">
            <span className="field__label">Password</span>
            <div className="field__password">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password ? (
              <span className="field__error">{fieldErrors.password}</span>
            ) : null}
          </div>

          <div className="field">
            <span className="field__label">Confirm password</span>
            <div className="field__password">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowConfirm((v) => !v)}
                disabled={loading}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <span className="field__error">{fieldErrors.confirmPassword}</span>
            ) : null}
          </div>

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>

          <p className="login-form__switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
