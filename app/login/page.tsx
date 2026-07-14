import { signIn } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to review designs and pick up the feedback."
      footer={<>New to MarkUp? <AuthLink href="/signup">Create an account</AuthLink></>}
    >
      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn(formData);
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="field" />
        </div>
        <button type="submit" className="btn-primary mt-1 w-full">Log in</button>
      </form>
    </AuthShell>
  );
}
