import { registerViewer } from './registry';
import { ActionView } from './ActionView';
import { CycleView } from './CycleView';
import { DecisionView } from './DecisionView';
import { MissionView } from './MissionView';
import { OrgView } from './OrgView';
import { PersonView } from './PersonView';
import { PriorityView } from './PriorityView';
import { ServiceView } from './ServiceView';
import { SquadView } from './SquadView';
import { SystemOfRecordView } from './SystemOfRecordView';
import { TeamView } from './TeamView';
import { WorkstreamView } from './WorkstreamView';
import { WorkflowView } from './WorkflowView';
import { SkillView } from './SkillView';

export function registerBuiltinViewers(): void {
  registerViewer('workflow', WorkflowView);
  registerViewer('action', ActionView);
  registerViewer('github-action', ActionView);
  registerViewer('skill', SkillView);
  registerViewer('person', PersonView);
  registerViewer('squad', SquadView);
  registerViewer('workstream', WorkstreamView);
  registerViewer('mission', MissionView);
  registerViewer('priority', PriorityView);
  registerViewer('cycle', CycleView);
  registerViewer('org', OrgView);
  registerViewer('team', TeamView);
  registerViewer('system-of-record', SystemOfRecordView);
  registerViewer('service', ServiceView);
  registerViewer('decision', DecisionView);
}
