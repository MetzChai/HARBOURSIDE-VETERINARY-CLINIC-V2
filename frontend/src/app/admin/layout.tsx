import AdminLayout from "@/layouts/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin", "staff"]}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

