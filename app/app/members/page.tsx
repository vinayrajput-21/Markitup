import { getWorkspaceMembers, addMemberByEmail } from "@/app/app/actions";
import { Avatar } from "@/components/app/AppSidebar";
import { SubmitButton } from "@/components/ui/SubmitButton";

function RoleChip({ role }: { role: string }) {
  const isOwner = role === "owner" || role === "admin";
  return (
    <span
      className="chip capitalize"
      style={
        isOwner
          ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }
          : { background: "var(--color-canvas)", color: "var(--color-muted)" }
      }
    >
      {role}
    </span>
  );
}

export default async function MembersPage() {
  const members = await getWorkspaceMembers();

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Team members</h1>
        <p className="mt-1 text-sm text-muted">
          {members.length} {members.length === 1 ? "person" : "people"} in this workspace
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await addMemberByEmail(formData);
        }}
        className="mb-7 flex gap-2"
      >
        <input
          name="email"
          type="email"
          placeholder="teammate@agency.com"
          className="field flex-1"
          required
        />
        <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
      </form>

      <div className="card divide-y overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.name} email={m.email} size={38} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{m.name || m.email}</div>
              {m.name && <div className="truncate text-xs text-faint">{m.email}</div>}
            </div>
            <RoleChip role={m.role} />
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted">
        Adding an email that already has an account adds them immediately. New
        emails create a pending invitation (email delivery arrives in a later phase).
      </p>
    </div>
  );
}
