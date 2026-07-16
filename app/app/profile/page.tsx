import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateProfileName } from "@/app/app/actions";
import { emailLocalPart } from "@/lib/format";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? "";
  const name =
    (data.user?.user_metadata?.name as string) || emailLocalPart(email) || "";

  return (
    <div className="mx-auto max-w-lg px-8 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
      <p className="mt-1 text-sm text-muted">Update how your name appears on comments and shares.</p>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateProfileName(formData);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <div>
          <label htmlFor="name" className="field-label">Display name</label>
          <input id="name" name="name" defaultValue={name} required className="field" />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input value={email} disabled className="field opacity-70" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Save changes</button>
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:text-brand-hover">
            Change password
          </Link>
        </div>
      </form>
    </div>
  );
}
