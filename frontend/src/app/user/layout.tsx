import UserLayout from "@/layouts/UserLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="owner">
      <UserLayout>{children}</UserLayout>
    </ProtectedRoute>
  );
}

