import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { HomePage } from "@/pages/Home";
import { SubmitPage } from "@/pages/Submit";
import { TrackPage } from "@/pages/Track";
import { LoginPage } from "@/pages/Login";
import { AdminLayout } from "@/pages/Admin/layout";
import { AdminDashboard } from "@/pages/Admin";
import { AdminComplaintsPage } from "@/pages/Admin/Complaints";
import { AdminUrgentPage } from "@/pages/Admin/Urgent";
import { AdminUsersPage } from "@/pages/Admin/Users";
import { AdminApprovalsPage } from "@/pages/Admin/Approvals";
import { AdminAnalyticsPage } from "@/pages/Admin/Analytics";
import { VendorLayout } from "@/pages/Vendor/layout";
import { VendorDashboard } from "@/pages/Vendor";
import { VendorComplaintsPage } from "@/pages/Vendor/Complaints";
import { VendorCasePreviewPage } from "@/pages/Vendor/CasePreview";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/track/:token" element={<TrackPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="complaints" element={<AdminComplaintsPage />} />
          <Route path="complaints/urgent" element={<AdminUrgentPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="departments" element={<div className="p-6 text-muted-foreground text-sm">Departments — coming next</div>} />
          <Route path="approvals" element={<AdminApprovalsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
        </Route>

        {/* Vendor — case preview (device token, no full auth gate) */}
        <Route path="/vendor/case/:caseId" element={<VendorCasePreviewPage />} />

        {/* Vendor */}
        <Route
          path="/vendor"
          element={
            <ProtectedRoute allowedRoles={["vendor"]}>
              <VendorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<VendorDashboard />} />
          <Route path="complaints" element={<VendorComplaintsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
