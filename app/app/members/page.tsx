import { getWorkspaceMembers, addMemberByEmail } from "@/app/app/actions";

export default async function MembersPage() {
  const members = await getWorkspaceMembers();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Team members</h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          await addMemberByEmail(formData);
        }}
        className="mb-6 flex gap-2"
      >
        <input name="email" type="email" placeholder="teammate@agency.com" className="flex-1 border p-2" required />
        <button className="bg-black px-4 text-white">Add</button>
      </form>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex justify-between border p-3">
            <span>{m.name || m.email}</span>
            <span className="text-sm text-gray-500">{m.role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-500">
        Adding an email that already has an account adds them immediately. New
        emails create a pending invitation (email delivery arrives in Plan 2).
      </p>
    </div>
  );
}
