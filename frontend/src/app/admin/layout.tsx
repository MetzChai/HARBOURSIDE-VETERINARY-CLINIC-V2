import AdminLayout from "@/layouts/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="admin">
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

