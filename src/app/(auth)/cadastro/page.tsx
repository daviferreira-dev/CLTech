import { Suspense } from "react";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  // useSearchParams (callbackUrl) exige fronteira de Suspense.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
