import UserLayout from "@/layouts/UserLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <UserLayout>{children}</UserLayout>
    </ProtectedRoute>
  );
}

