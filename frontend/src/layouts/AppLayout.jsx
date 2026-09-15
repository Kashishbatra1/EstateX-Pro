import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/layout.css";

const TITLES = {
  "/dashboard": "Dashboard",
  "/properties": "Properties",
  "/maintenance": "Maintenance",
  "/owners": "Owners",
  "/banks": "Banks",
  "/clients": "Clients",
  "/bookings": "Bookings",
  "/payments": "Payments",
  "/expenses": "Expenses",
  "/inventory": "Inventory",
  "/vendors": "Vendors",
  "/recurring": "Recurring Expenses",
  "/budgets": "Budgets",
  "/petty-cash": "Petty Cash",
  "/favorites": "Favorites",
  "/calendar": "Booking Calendar",
  "/search": "Global Search",
  "/recycle-bin": "Recycle Bin",
  "/backups": "Backup & Restore",
  "/audit-logs": "Audit Log",
  "/commissions": "Commissions",
  "/transfers": "Transfers",
  "/reports": "Reports",
  "/notifications": "Notifications",
};

function resolveTitle(pathname) {
  if (pathname === "/properties/new") return "Add Property";
  if (/^\/properties\/[^/]+\/edit$/.test(pathname)) return "Edit Property";
  if (/^\/properties\/[^/]+$/.test(pathname)) return "Property Details";
  if (pathname === "/maintenance/new") return "Add Maintenance Task";
  if (/^\/maintenance\/[^/]+\/edit$/.test(pathname)) return "Edit Maintenance Task";
  if (/^\/maintenance\/[^/]+$/.test(pathname)) return "Maintenance Details";
  if (pathname === "/owners/new") return "Add Owner";
  if (/^\/owners\/[^/]+\/edit$/.test(pathname)) return "Edit Owner";
  if (/^\/owners\/[^/]+$/.test(pathname)) return "Owner Details";
  if (pathname === "/banks/new") return "Add Bank";
  if (/^\/banks\/[^/]+\/edit$/.test(pathname)) return "Edit Bank";
  if (/^\/banks\/[^/]+$/.test(pathname)) return "Bank Details";
  if (pathname === "/clients/new") return "Add Client";
  if (/^\/clients\/[^/]+\/edit$/.test(pathname)) return "Edit Client";
  if (/^\/clients\/[^/]+$/.test(pathname)) return "Client Profile";
  if (pathname === "/bookings/new") return "Add Booking";
  if (/^\/bookings\/[^/]+\/edit$/.test(pathname)) return "Edit Booking";
  if (/^\/bookings\/[^/]+$/.test(pathname)) return "Booking Details";
  if (pathname === "/payments/new") return "Add Payment";
  if (/^\/payments\/[^/]+\/edit$/.test(pathname)) return "Edit Payment";
  if (/^\/payments\/[^/]+$/.test(pathname)) return "Payment Details";
  if (pathname === "/expenses/new") return "Add Expense";
  if (/^\/expenses\/[^/]+\/edit$/.test(pathname)) return "Edit Expense";
  if (/^\/expenses\/[^/]+$/.test(pathname)) return "Expense Details";
  if (pathname === "/inventory/new") return "Add Inventory Item";
  if (/^\/inventory\/[^/]+\/edit$/.test(pathname)) return "Edit Inventory Item";
  if (/^\/inventory\/[^/]+$/.test(pathname)) return "Inventory Details";
  if (pathname === "/vendors/new") return "Add Vendor";
  if (/^\/vendors\/[^/]+\/edit$/.test(pathname)) return "Edit Vendor";
  if (/^\/vendors\/[^/]+$/.test(pathname)) return "Vendor Details";
  if (pathname === "/recurring/new") return "Add Recurring Expense";
  if (/^\/recurring\/[^/]+\/edit$/.test(pathname)) return "Edit Recurring Expense";
  if (/^\/recurring\/[^/]+$/.test(pathname)) return "Recurring Expense Details";
  if (pathname === "/budgets/new") return "Add Budget";
  if (/^\/budgets\/[^/]+\/edit$/.test(pathname)) return "Edit Budget";
  if (/^\/budgets\/[^/]+$/.test(pathname)) return "Budget Details";
  if (pathname === "/petty-cash/new") return "Add Petty Cash Account";
  if (/^\/petty-cash\/[^/]+\/edit$/.test(pathname)) return "Edit Petty Cash Account";
  if (/^\/petty-cash\/[^/]+$/.test(pathname)) return "Petty Cash Details";
  if (pathname === "/commissions/new") return "Add Commission";
  if (/^\/commissions\/[^/]+\/edit$/.test(pathname)) return "Edit Commission";
  if (/^\/commissions\/[^/]+$/.test(pathname)) return "Commission Details";
  if (pathname === "/transfers/new") return "Record Transfer";
  if (/^\/transfers\/[^/]+\/edit$/.test(pathname)) return "Edit Transfer";
  if (/^\/transfers\/[^/]+$/.test(pathname)) return "Transfer Details";
  return TITLES[pathname] || "EstateX Pro";
}

export default function AppLayout() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const title = resolveTitle(location.pathname);
  const year = new Date().getFullYear();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="app-main">
        <Header
          title={title}
          admin={admin}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          onLogout={handleLogout}
        />
        <main className="app-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>EstateX Pro</span>
          <span className="app-footer__sep" aria-hidden="true">
            ·
          </span>
          <span>GWS Property Services</span>
          <span className="app-footer__sep" aria-hidden="true">
            ·
          </span>
          <span>© {year}</span>
        </footer>
      </div>
    </div>
  );
}
