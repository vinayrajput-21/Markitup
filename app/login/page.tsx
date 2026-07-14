import { signIn } from "@/app/auth/actions";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Log in</h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn(formData);
        }}
        className="flex flex-col gap-3"
      >
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        <button type="submit" className="bg-black p-2 text-white">Log in</button>
      </form>
      <p className="mt-4 text-sm">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </main>
  );
}
