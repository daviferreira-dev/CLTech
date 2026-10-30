import { Suspense } from "react";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Criar conta" };

export default function RegisterPage() {
  // useSearchParams (callbackUrl) exige fronteira de Suspense.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
