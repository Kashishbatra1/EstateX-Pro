import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listNotifications } from "../api/notifications.js";
import "../styles/notifications.css";

export default function Header({ title, admin, onMenuToggle, onLogout }) {
  const [unreadCount, setUnreadCount] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = (admin?.fullName || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const refreshUnread = useCallback(async () => {
    try {
      const data = await listNotifications({ limit: 1 });
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      // Keep last known count on failure
    }
  }, []);

  useEffect(() => {
    refreshUnread();
    function onChanged() {
      refreshUnread();
    }
    window.addEventListener("estatex:notifications-changed", onChanged);
    return () => {
      window.removeEventListener("estatex:notifications-changed", onChanged);
    };
  }, [refreshUnread]);

  useEffect(() => {
    function onDocClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const badgeLabel =
    unreadCount == null
      ? "Notifications"
      : unreadCount > 0
        ? `Notifications, ${unreadCount} unread`
        : "Notifications, no unread";

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="topbar__menu"
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="topbar__eyebrow">
            EstateX Pro · {admin?.roleLabel || "Admin"}
          </p>
          <h1 className="topbar__title">{title}</h1>
        </div>
      </div>

      <div className="topbar__right">
        <Link to="/search" className="topbar__icon-link" aria-label="Global search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M16.5 16.5 20 20"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </Link>
        <Link
          to="/notifications"
          className="topbar__notify"
          aria-label={badgeLabel}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.2 1.4-.6 2L4 16h16l-1.4-2.8c-.4-.6-.6-1.3-.6-2V9a6 6 0 0 0-6-6Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {unreadCount != null && unreadCount > 0 ? (
            <span className="topbar__badge" aria-hidden="true">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <div className="topbar__profile-wrap" ref={menuRef}>
          <button
            type="button"
            className="topbar__profile"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="topbar__avatar" aria-hidden="true">
              {initials || "A"}
            </span>
            <div className="topbar__profile-text">
              <p className="topbar__admin-name">{admin?.fullName || "Admin"}</p>
              <p className="topbar__admin-role">
                {admin?.roleLabel || "Administrator"}
              </p>
            </div>
          </button>
          {menuOpen ? (
            <div className="topbar__menu-panel" role="menu">
              <p className="topbar__menu-email muted tiny">
                {admin?.email || "Signed in"}
              </p>
              <Link
                to="/dashboard"
                role="menuitem"
                className="topbar__menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/search"
                role="menuitem"
                className="topbar__menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Search
              </Link>
              <Link
                to="/favorites"
                role="menuitem"
                className="topbar__menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Favorites
              </Link>
              <Link
                to="/reports"
                role="menuitem"
                className="topbar__menu-item"
                onClick={() => setMenuOpen(false)}
              >
                Reports
              </Link>
              <button
                type="button"
                role="menuitem"
                className="topbar__menu-item topbar__menu-item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout?.();
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
