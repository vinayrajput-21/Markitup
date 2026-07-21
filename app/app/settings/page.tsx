import { getFigmaConnection } from "@/app/app/figma-actions";
import { FigmaConnect } from "@/components/app/FigmaConnect";

export default async function SettingsPage() {
  const { connected } = await getFigmaConnection();

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Workspace integrations and connections.</p>
      </div>

      <h2 className="mb-3 text-xs font-semibold tracking-wider text-faint uppercase">Integrations</h2>
      <FigmaConnect connected={connected} />
    </div>
  );
}
