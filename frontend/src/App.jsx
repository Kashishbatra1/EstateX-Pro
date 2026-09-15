import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PropertiesPage from "./pages/properties/PropertiesPage.jsx";
import PropertyCreatePage from "./pages/properties/PropertyCreatePage.jsx";
import PropertyDetailPage from "./pages/properties/PropertyDetailPage.jsx";
import PropertyEditPage from "./pages/properties/PropertyEditPage.jsx";
import OwnersPage from "./pages/owners/OwnersPage.jsx";
import OwnerCreatePage from "./pages/owners/OwnerCreatePage.jsx";
import OwnerDetailPage from "./pages/owners/OwnerDetailPage.jsx";
import OwnerEditPage from "./pages/owners/OwnerEditPage.jsx";
import BanksPage from "./pages/banks/BanksPage.jsx";
import BankCreatePage from "./pages/banks/BankCreatePage.jsx";
import BankDetailPage from "./pages/banks/BankDetailPage.jsx";
import BankEditPage from "./pages/banks/BankEditPage.jsx";
import ClientsPage from "./pages/clients/ClientsPage.jsx";
import ClientCreatePage from "./pages/clients/ClientCreatePage.jsx";
import ClientDetailPage from "./pages/clients/ClientDetailPage.jsx";
import ClientEditPage from "./pages/clients/ClientEditPage.jsx";
import BookingsPage from "./pages/bookings/BookingsPage.jsx";
import BookingCreatePage from "./pages/bookings/BookingCreatePage.jsx";
import BookingDetailPage from "./pages/bookings/BookingDetailPage.jsx";
import BookingEditPage from "./pages/bookings/BookingEditPage.jsx";
import PaymentsPage from "./pages/payments/PaymentsPage.jsx";
import PaymentCreatePage from "./pages/payments/PaymentCreatePage.jsx";
import PaymentDetailPage from "./pages/payments/PaymentDetailPage.jsx";
import PaymentEditPage from "./pages/payments/PaymentEditPage.jsx";
import ExpensesPage from "./pages/expenses/ExpensesPage.jsx";
import ExpenseCreatePage from "./pages/expenses/ExpenseCreatePage.jsx";
import ExpenseDetailPage from "./pages/expenses/ExpenseDetailPage.jsx";
import ExpenseEditPage from "./pages/expenses/ExpenseEditPage.jsx";
import InventoryPage from "./pages/inventory/InventoryPage.jsx";
import InventoryCreatePage from "./pages/inventory/InventoryCreatePage.jsx";
import InventoryDetailPage from "./pages/inventory/InventoryDetailPage.jsx";
import InventoryEditPage from "./pages/inventory/InventoryEditPage.jsx";
import VendorsPage from "./pages/vendors/VendorsPage.jsx";
import VendorCreatePage from "./pages/vendors/VendorCreatePage.jsx";
import VendorDetailPage from "./pages/vendors/VendorDetailPage.jsx";
import VendorEditPage from "./pages/vendors/VendorEditPage.jsx";
import RecurringExpensesPage from "./pages/recurring/RecurringExpensesPage.jsx";
import RecurringCreatePage from "./pages/recurring/RecurringCreatePage.jsx";
import RecurringDetailPage from "./pages/recurring/RecurringDetailPage.jsx";
import RecurringEditPage from "./pages/recurring/RecurringEditPage.jsx";
import BudgetsPage from "./pages/budgets/BudgetsPage.jsx";
import BudgetCreatePage from "./pages/budgets/BudgetCreatePage.jsx";
import BudgetDetailPage from "./pages/budgets/BudgetDetailPage.jsx";
import BudgetEditPage from "./pages/budgets/BudgetEditPage.jsx";
import PettyCashPage from "./pages/pettyCash/PettyCashPage.jsx";
import PettyCashCreatePage from "./pages/pettyCash/PettyCashCreatePage.jsx";
import PettyCashDetailPage from "./pages/pettyCash/PettyCashDetailPage.jsx";
import PettyCashEditPage from "./pages/pettyCash/PettyCashEditPage.jsx";
import MaintenancePage from "./pages/maintenance/MaintenancePage.jsx";
import MaintenanceCreatePage from "./pages/maintenance/MaintenanceCreatePage.jsx";
import MaintenanceDetailPage from "./pages/maintenance/MaintenanceDetailPage.jsx";
import MaintenanceEditPage from "./pages/maintenance/MaintenanceEditPage.jsx";
import FavoritesPage from "./pages/favorites/FavoritesPage.jsx";
import CalendarPage from "./pages/calendar/CalendarPage.jsx";
import SearchPage from "./pages/system/SearchPage.jsx";
import RecycleBinPage from "./pages/system/RecycleBinPage.jsx";
import BackupsPage from "./pages/system/BackupsPage.jsx";
import AuditLogsPage from "./pages/system/AuditLogsPage.jsx";
import CommissionsPage from "./pages/commissions/CommissionsPage.jsx";
import CommissionCreatePage from "./pages/commissions/CommissionCreatePage.jsx";
import CommissionDetailPage from "./pages/commissions/CommissionDetailPage.jsx";
import CommissionEditPage from "./pages/commissions/CommissionEditPage.jsx";
import TransfersPage from "./pages/transfers/TransfersPage.jsx";
import TransferCreatePage from "./pages/transfers/TransferCreatePage.jsx";
import TransferDetailPage from "./pages/transfers/TransferDetailPage.jsx";
import TransferEditPage from "./pages/transfers/TransferEditPage.jsx";
import ReportsPage from "./pages/reports/ReportsPage.jsx";
import NotificationsPage from "./pages/notifications/NotificationsPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function PublicOnly({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <div className="app-boot">
        <div className="spinner" aria-hidden="true" />
        <p>Loading EstateX Pro…</p>
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function GuestHome() {
  const { isAuthenticated, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <div className="app-boot">
        <div className="spinner" aria-hidden="true" />
        <p>Loading EstateX Pro…</p>
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

function CatchAllRedirect() {
  const { isAuthenticated, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <div className="app-boot">
        <div className="spinner" aria-hidden="true" />
        <p>Loading EstateX Pro…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestHome />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/new" element={<PropertyCreatePage />} />
        <Route path="/properties/:id" element={<PropertyDetailPage />} />
        <Route path="/properties/:id/edit" element={<PropertyEditPage />} />
        <Route path="/owners" element={<OwnersPage />} />
        <Route path="/owners/new" element={<OwnerCreatePage />} />
        <Route path="/owners/:id" element={<OwnerDetailPage />} />
        <Route path="/owners/:id/edit" element={<OwnerEditPage />} />
        <Route path="/banks" element={<BanksPage />} />
        <Route path="/banks/new" element={<BankCreatePage />} />
        <Route path="/banks/:id" element={<BankDetailPage />} />
        <Route path="/banks/:id/edit" element={<BankEditPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/new" element={<ClientCreatePage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/clients/:id/edit" element={<ClientEditPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/new" element={<BookingCreatePage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/bookings/:id/edit" element={<BookingEditPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/new" element={<PaymentCreatePage />} />
        <Route path="/payments/:id" element={<PaymentDetailPage />} />
        <Route path="/payments/:id/edit" element={<PaymentEditPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/expenses/new" element={<ExpenseCreatePage />} />
        <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
        <Route path="/expenses/:id/edit" element={<ExpenseEditPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/new" element={<InventoryCreatePage />} />
        <Route path="/inventory/:id" element={<InventoryDetailPage />} />
        <Route path="/inventory/:id/edit" element={<InventoryEditPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/vendors/new" element={<VendorCreatePage />} />
        <Route path="/vendors/:id" element={<VendorDetailPage />} />
        <Route path="/vendors/:id/edit" element={<VendorEditPage />} />
        <Route path="/recurring" element={<RecurringExpensesPage />} />
        <Route path="/recurring/new" element={<RecurringCreatePage />} />
        <Route path="/recurring/:id" element={<RecurringDetailPage />} />
        <Route path="/recurring/:id/edit" element={<RecurringEditPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/budgets/new" element={<BudgetCreatePage />} />
        <Route path="/budgets/:id" element={<BudgetDetailPage />} />
        <Route path="/budgets/:id/edit" element={<BudgetEditPage />} />
        <Route path="/petty-cash" element={<PettyCashPage />} />
        <Route path="/petty-cash/new" element={<PettyCashCreatePage />} />
        <Route path="/petty-cash/:id" element={<PettyCashDetailPage />} />
        <Route path="/petty-cash/:id/edit" element={<PettyCashEditPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/maintenance/new" element={<MaintenanceCreatePage />} />
        <Route path="/maintenance/:id" element={<MaintenanceDetailPage />} />
        <Route path="/maintenance/:id/edit" element={<MaintenanceEditPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/recycle-bin" element={<RecycleBinPage />} />
        <Route path="/backups" element={<BackupsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/commissions" element={<CommissionsPage />} />
        <Route path="/commissions/new" element={<CommissionCreatePage />} />
        <Route path="/commissions/:id" element={<CommissionDetailPage />} />
        <Route path="/commissions/:id/edit" element={<CommissionEditPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/transfers/new" element={<TransferCreatePage />} />
        <Route path="/transfers/:id" element={<TransferDetailPage />} />
        <Route path="/transfers/:id/edit" element={<TransferEditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
