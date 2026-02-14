import type { Project, Sale } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { ProgressBar } from '../components/ProgressBar';

interface LaunchListPageProps {
  projects: Project[];
  sales: Sale[];
  loading: boolean;
  onOpen: (id: string) => void;
  onRefresh: () => void;
}

export const LaunchListPage = ({
  projects,
  sales,
  loading,
  onOpen,
  onRefresh,
}: LaunchListPageProps) => {
  if (loading) return <p className="empty-state">Loading launches...</p>;

  return (
    <section className="panel-stack">
      <div className="section-head">
        <h2>Trending Launches</h2>
        <button className="ghost-button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {projects.map((project) => {
        const sale = sales.find((item) => item.projectId === project.id);
        const raised = Number(sale?.raisedAmount ?? project.raisedAmount ?? '0');
        const progress = (raised / Math.max(1, Number(project.hardCap))) * 100;

        return (
          <article className="card launch-card" key={project.id}>
            <div className="section-head">
              <div>
                <h3>{project.name}</h3>
                <p>{project.description}</p>
              </div>
              <div className="row">
                {sale ? <span className={`pill state-${sale.state}`}>{sale.state}</span> : null}
                <button className="primary-button" onClick={() => onOpen(project.id)}>
                  View
                </button>
              </div>
            </div>
            <ProgressBar value={progress} label="Sale progress" />
            {sale ? (
              <p className="countdown-line">
                Ends in <CountdownTimer targetIso={sale.endsAt} />
              </p>
            ) : null}
          </article>
        );
      })}
      {!projects.length ? <p className="empty-state">No launches yet.</p> : null}
    </section>
  );
};
