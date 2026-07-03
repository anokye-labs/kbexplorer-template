export type KnownRelation =
  | 'leads'
  | 'staffs'
  | 'reports-to'
  | 'structural'
  | 'derived'
  | 'deprecated'
  // Work-graph organizational-layer relations (#233)
  | 'owns'
  | 'has-priority'
  | 'tracked-in'
  // Person-node active-work relations (#235)
  | 'assigned-to'
  | 'authored'
  | 'member-of';
