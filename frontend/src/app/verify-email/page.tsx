import { Suspense } from "react";
import VerifyEmailPage from "@/views/VerifyEmailPage";

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}
