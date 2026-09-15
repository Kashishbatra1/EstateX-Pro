import { NavLink } from "react-router-dom";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/notifications", label: "Notifications" },
      { to: "/reports", label: "Reports" },
    ],
  },
  {
    label: "Property",
    items: [
      { to: "/properties", label: "Properties" },
      { to: "/owners", label: "Owners" },
      { to: "/banks", label: "Banks" },
      { to: "/maintenance", label: "Maintenance" },
      { to: "/transfers", label: "Transfers" },
    ],
  },
  {
    label: "CRM & Sales",
    items: [
      { to: "/clients", label: "Clients" },
      { to: "/bookings", label: "Bookings" },
      { to: "/payments", label: "Payments" },
      { to: "/commissions", label: "Commissions" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/expenses", label: "Expenses" },
      { to: "/recurring", label: "Recurring" },
      { to: "/vendors", label: "Vendors" },
      { to: "/inventory", label: "Inventory" },
      { to: "/budgets", label: "Budgets" },
      { to: "/petty-cash", label: "Petty Cash" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/favorites", label: "Favorites" },
      { to: "/calendar", label: "Booking Calendar" },
      { to: "/search", label: "Search" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/recycle-bin", label: "Recycle Bin" },
      { to: "/backups", label: "Backups" },
      { to: "/audit-logs", label: "Audit Log" },
    ],
  },
];

export default function Sidebar({ open, onClose, onLogout }) {
  return (
    <>
      <div
        className={`sidebar-backdrop${open ? " is-visible" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true" />
          <div>
            <p className="sidebar__name">EstateX Pro</p>
            <p className="sidebar__tag">Property Admin</p>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sidebar__group">
              <p className="sidebar__group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard"}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? " is-active" : ""}`
                  }
                  onClick={onClose}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button type="button" className="sidebar__logout" onClick={onLogout}>
          Logout
        </button>
      </aside>
    </>
  );
}
