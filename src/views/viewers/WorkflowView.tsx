import type { ViewerProps } from './GenericStructuredView';

/**
 * Bespoke viewer for GitHub workflow nodes (F3 / #168).
 *
 * Reads the parsed workflow object off `node.data` (kept intact so the node
 * stays reversible) and surfaces the three things reviewers care about:
 * **triggers** (`on`), **jobs**, and each job's **steps**. SSR-safe: plain
 * elements + classNames only, so it renders identically in tests and the app.
 */

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
}

interface WorkflowJob {
  id: string;
  name?: string;
  runsOn?: string;
  steps: WorkflowStep[];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Normalise a workflow `on:` value (string | array | object) to event names. */
export function extractTriggers(on: unknown): string[] {
  if (!on) return [];
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.filter((e): e is string => typeof e === 'string');
  if (typeof on === 'object') return Object.keys(on as Record<string, unknown>);
  return [];
}

/** Normalise a workflow `jobs:` map to a stable, render-friendly list. */
export function extractJobs(jobs: unknown): WorkflowJob[] {
  const map = asRecord(jobs);
  return Object.entries(map).map(([id, raw]) => {
    const job = asRecord(raw);
    const stepsRaw = Array.isArray(job.steps) ? job.steps : [];
    const steps: WorkflowStep[] = stepsRaw.map(s => {
      const step = asRecord(s);
      return {
        name: typeof step.name === 'string' ? step.name : undefined,
        uses: typeof step.uses === 'string' ? step.uses : undefined,
        run: typeof step.run === 'string' ? step.run : undefined,
      };
    });
    return {
      id,
      name: typeof job.name === 'string' ? job.name : undefined,
      runsOn: typeof job['runs-on'] === 'string' ? (job['runs-on'] as string) : undefined,
      steps,
    };
  });
}

export function WorkflowView({ node }: ViewerProps) {
  const data = asRecord(node.data);
  const name = (typeof data.name === 'string' && data.name) || node.title;
  const triggers = extractTriggers(data.on);
  const jobs = extractJobs(data.jobs);

  return (
    <div className="kb-structured-view kb-workflow-view">
      <div className="kb-structured-header">
        <span className="kb-structured-type" title="JSON-LD @type">Workflow</span>
        {node.jsonld?.['@id'] && <code className="kb-structured-id">{node.jsonld['@id']}</code>}
      </div>
      <h2 className="kb-workflow-name">{name}</h2>

      <section className="kb-workflow-triggers">
        <h3 className="kb-structured-key">Triggers</h3>
        {triggers.length > 0 ? (
          <ul className="kb-structured-list">
            {triggers.map(t => (
              <li key={t}><code className="kb-structured-code">{t}</code></li>
            ))}
          </ul>
        ) : (
          <span className="kb-structured-empty">No triggers declared</span>
        )}
      </section>

      <section className="kb-workflow-jobs">
        <h3 className="kb-structured-key">Jobs ({jobs.length})</h3>
        {jobs.length === 0 && <span className="kb-structured-empty">No jobs declared</span>}
        {jobs.map(job => (
          <div key={job.id} className="kb-workflow-job">
            <div className="kb-workflow-job-head">
              <strong className="kb-workflow-job-id">{job.name ?? job.id}</strong>
              {job.runsOn && <span className="kb-workflow-runson"> · {job.runsOn}</span>}
            </div>
            {job.steps.length > 0 && (
              <ol className="kb-workflow-steps">
                {job.steps.map((step, i) => (
                  <li key={i} className="kb-workflow-step">
                    {step.name ?? step.uses ?? (step.run ? step.run.split('\n')[0] : `Step ${i + 1}`)}
                    {step.uses && !step.name && <code className="kb-structured-code"> {step.uses}</code>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
