import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const linkedInEnabled = Boolean(process.env.LINKEDIN_ID);

  return (
    <Suspense>
      <LoginForm linkedInEnabled={linkedInEnabled} />
    </Suspense>
  );
}
