import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ApiError } from "../api/client.js";
import "../styles/login.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  function validate() {
    const next = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      next.email = "Email format is invalid";
    }
    if (!password) next.password = "Password is required";
    else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
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
      await login(email.trim(), password);
      // Strict flow: Login → Dashboard (ignore public routes as return targets)
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const mapped = {};
        for (const item of err.details) {
          if (item?.field) mapped[item.field] = item.message;
        }
        if (Object.keys(mapped).length) setFieldErrors(mapped);
      }
      setFormError(err.message || "Login failed");
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
          <h2 className="login-form__title">Admin sign in</h2>

          {flash ? (
            <div className="alert alert--success" role="status">
              {flash}
            </div>
          ) : null}

          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

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
              placeholder="admin@estatex.pro"
            />
            {fieldErrors.email ? (
              <span className="field__error">{fieldErrors.email}</span>
            ) : null}
          </label>

          <div className="field">
            <span className="field__label">Password</span>
            <div className="field__password">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.password)}
                placeholder="Enter your password"
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

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="login-form__switch muted">
            Need a Super Admin or Admin account?{" "}
            <Link to="/signup">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
