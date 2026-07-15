import { signInAction } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to review designs and pick up the feedback."
      footer={<>New to MarkUp? <AuthLink href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</AuthLink></>}
    >
      <AuthForm action={signInAction} next={next} submitLabel="Log in">
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="field" />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
