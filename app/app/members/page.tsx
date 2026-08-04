import { getTeamData } from "@/app/app/team-actions";
import { TeamRoster } from "@/components/app/TeamRoster";
import { TeamInviteDialog } from "@/components/app/TeamInviteDialog";
import { RoleMatrix } from "@/components/app/RoleMatrix";

export default async function MembersPage() {
  const data = await getTeamData();

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted">Invite people and manage what they can access.</p>
        </div>
        {data.canManage && <TeamInviteDialog />}
      </div>

      <TeamRoster data={data} />

      <RoleMatrix />
    </div>
  );
}
