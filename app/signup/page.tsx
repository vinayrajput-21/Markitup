import { signUp } from "@/app/auth/actions";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Sign up</h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          await signUp(formData);
        }}
        className="flex flex-col gap-3"
      >
        <input name="name" type="text" placeholder="Name" required className="border p-2" />
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required minLength={6} className="border p-2" />
        <button type="submit" className="bg-black p-2 text-white">Sign up</button>
      </form>
      <p className="mt-4 text-sm">
        Have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}
