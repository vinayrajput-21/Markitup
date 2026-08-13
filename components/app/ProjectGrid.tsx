import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";
import type { ProjectItem } from "@/app/app/dashboard-data";

export function ProjectGrid({ items }: { items: ProjectItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <li key={p.id}>
          <ProjectCard
            id={p.id}
            name={p.name}
            coverUrl={p.coverUrl}
            coverIsHtml={p.coverIsHtml}
            updatedAt={p.updatedAt}
            stats={p.stats}
            viewers={p.viewers}
            lastViewedAt={p.lastViewedAt}
            menu={<ProjectCardMenu projectId={p.id} name={p.name} />}
          />
        </li>
      ))}
    </ul>
  );
}
