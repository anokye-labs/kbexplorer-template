/** Core data types for the kbexplorer knowledge graph. */

/** A node in the knowledge graph. */
export interface KBNode {
  id: string;
  title: string;
  cluster: string;
  content: string; // HTML rendered from markdown
  rawContent: string; // Original markdown
  emoji?: string;
  image?: string; // path relative to repo root (heroes mode)
  sprite?: string; // path relative to repo root (sprites mode)
  parent?: string; // parent node id (for hierarchy)
  nodeType?: 'parent' | 'section'; // parent has children, section is a child
  connections: Connection[];
  /** Source of this node: authored markdown or GitHub artifact */
  source: NodeSource;
}

export type EdgeType =
  | 'contains'
  | 'derived_from'
  | 'imports'
  | 'references'
  | 'frontmatter'
  | 'mentions'
  | 'cross_references'
  | 'modifies'
  | 'closes'
  | 'related';

export type EdgeSource = 'inline' | 'frontmatter' | 'inferred';

/** Default weights per edge type — higher = tighter layout clustering */
export const EDGE_TYPE_WEIGHTS: Record<EdgeType, number> = {
  contains: 5.0,
  derived_from: 3.0,
  imports: 2.0,
  references: 2.0,
  frontmatter: 1.5,
  cross_references: 1.5,
  modifies: 1.0,
  closes: 2.0,
  mentions: 0.5,
  related: 0.3,
};

/** Visual style for each edge type */
export interface EdgeTypeStyle {
  color: string;
  dashes: boolean | number[];
  width: number;
  label: string;
}

export const EDGE_TYPE_STYLES: Record<EdgeType, EdgeTypeStyle> = {
  contains:         { color: '#a0adb8', dashes: false,      width: 2,   label: 'Contains' },
  derived_from:     { color: '#e8a854', dashes: false,      width: 2,   label: 'Derived from' },
  imports:          { color: '#a78bfa', dashes: false,      width: 1.5, label: 'Imports' },
  references:       { color: '#79c0ff', dashes: false,      width: 1.5, label: 'References' },
  frontmatter:      { color: '#7ee787', dashes: [6, 4],     width: 1.5, label: 'Frontmatter' },
  cross_references: { color: '#f9a8d4', dashes: false,      width: 1.5, label: 'Cross-ref' },
  modifies:         { color: '#e3b341', dashes: [4, 4],     width: 1.5, label: 'Modifies' },
  closes:           { color: '#56d364', dashes: false,      width: 2,   label: 'Closes' },
  mentions:         { color: '#b1bac4', dashes: [3, 4],     width: 1.2, label: 'Mentions' },
  related:          { color: '#8b949e', dashes: [3, 3],     width: 1.2, label: 'Related' },
};

export type NodeLayer = 'file' | 'content' | 'work';

export const NODE_LAYER_META: Record<NodeLayer, { label: string; color: string }> = {
  file:    { label: 'Files',   color: '#9A8A78' },
  content: { label: 'Content', color: '#58a6ff' },
  work:    { label: 'Work',    color: '#d29922' },
};

/** Classify a node into a graph layer based on its source. */
export function getNodeLayer(node: KBNode): NodeLayer {
  const t = node.source.type;
  if (t === 'authored' || t === 'readme') return 'content';
  if (t === 'section') return 'content';
  if (t === 'issue' || t === 'pull_request' || t === 'commit') return 'work';
  return 'file';
}

export interface Connection {
  to: string;
  type?: EdgeType;
  description: string;
  source?: EdgeSource;
  weight?: number;
}

export interface Cluster {
  id: string;
  name: string;
  color: string;
}

/** Computed graph data, ready for visualization. */
export interface KBGraph {
  nodes: KBNode[];
  edges: KBEdge[];
  clusters: Cluster[];
  related: Record<string, string[]>; // nodeId → related nodeIds (max 8)
}

export interface KBEdge {
  from: string;
  to: string;
  type: EdgeType;
  description: string;
  source: EdgeSource;
  weight: number;
}

/** Visual identity mode. */
export type VisualMode = 'sprites' | 'heroes' | 'emoji' | 'none';

/** Theme preference. */
export type Theme = 'dark' | 'light' | 'sepia';

/** Content source configuration. */
export interface SourceConfig {
  owner: string;
  repo: string;
  path?: string; // content directory within repo (authored mode)
  branch?: string; // default: main
}

/** Where a node originated from. */
export type NodeSource =
  | { type: 'authored'; file: string }
  | { type: 'issue'; number: number; state: string; labels: string[] }
  | { type: 'pull_request'; number: number; state: string }
  | { type: 'commit'; sha: string }
  | { type: 'file'; path: string }
  | { type: 'readme' }
  | { type: 'section'; parentSource: NodeSource };

/** Full knowledge base configuration (from config.yaml). */
export interface KBConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  source: SourceConfig;
  clusters: Record<string, { name: string; color: string }>;
  visuals: {
    mode: VisualMode;
    fallback: VisualMode;
    hero?: {
      overlay?: 'dark-gradient' | 'light-gradient' | 'none';
      height?: string;
      animation?: 'reveal' | 'fade' | 'none';
    };
    hud?: {
      blurBackground?: boolean;
      blurOpacity?: number;
    };
    graph?: {
      nodeImages?: boolean;
      nodeSizeByConnections?: boolean;
    };
  };
  theme: {
    default: Theme;
    font?: {
      heading?: string;
      body?: string;
      mono?: string;
    };
  };
  graph: {
    physics: boolean;
    layout: 'force-atlas-2' | 'manual';
  };
  features: {
    hud: boolean;
    minimap: boolean;
    readingTools: boolean;
    keyboardNav: boolean;
    sparkAnimation: boolean;
  };
  bluf?: {
    audio?: string;
    quote?: string;
    duration?: string;
  };
}

/** Resolve the default source config from Vite env vars or fallback to hardcoded defaults. */
function resolveDefaultSource(): SourceConfig {
  const owner = import.meta.env.VITE_KB_OWNER;
  const repo = import.meta.env.VITE_KB_REPO;
  if (owner && repo) {
    return {
      owner,
      repo,
      branch: import.meta.env.VITE_KB_BRANCH ?? 'main',
      path: import.meta.env.VITE_KB_PATH || undefined,
    };
  }
  return { owner: 'anokye-labs', repo: 'kbexplorer', path: 'content', branch: 'main' };
}

/** Default configuration for repo-aware mode. */
export const DEFAULT_CONFIG: KBConfig = {
  title: import.meta.env.VITE_KB_TITLE ?? 'kbexplorer',
  subtitle: 'Interactive Knowledge Base Explorer',
  author: 'Anokye Labs',
  source: resolveDefaultSource(),
  clusters: {
    feature: { name: 'Feature', color: '#4A9CC8' },
    task: { name: 'Task', color: '#8CB050' },
    bug: { name: 'Bug', color: '#C04040' },
    epic: { name: 'Epic', color: '#E8A838' },
    code: { name: 'Code', color: '#9A8A78' },
    docs: { name: 'Documentation', color: '#D4A050' },
    'pull-request': { name: 'Pull Request', color: '#A86FDF' },
    commits: { name: 'Commits', color: '#5A98A8' },
  },
  visuals: {
    mode: 'emoji',
    fallback: 'emoji',
  },
  theme: {
    default: 'dark',
    font: {
      heading: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
      body: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
      mono: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    },
  },
  graph: {
    physics: true,
    layout: 'force-atlas-2',
  },
  features: {
    hud: true,
    minimap: true,
    readingTools: true,
    keyboardNav: true,
    sparkAnimation: false,
  },
};
