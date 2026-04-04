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
  connections: Connection[];
  /** Source of this node: authored markdown or GitHub artifact */
  source: NodeSource;
}

export interface Connection {
  to: string;
  description: string;
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
  description: string;
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
  | { type: 'file'; path: string }
  | { type: 'readme' };

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

/** Default configuration for repo-aware mode. */
export const DEFAULT_CONFIG: KBConfig = {
  title: 'kbexplorer',
  subtitle: 'Interactive Knowledge Base Explorer',
  author: 'Anokye Labs',
  source: {
    owner: 'anokye-labs',
    repo: 'kbexplorer',
    branch: 'main',
  },
  clusters: {
    feature: { name: 'Feature', color: '#4A9CC8' },
    task: { name: 'Task', color: '#8CB050' },
    bug: { name: 'Bug', color: '#C04040' },
    epic: { name: 'Epic', color: '#E8A838' },
    code: { name: 'Code', color: '#9A8A78' },
    docs: { name: 'Documentation', color: '#D4A050' },
  },
  visuals: {
    mode: 'emoji',
    fallback: 'emoji',
  },
  theme: {
    default: 'dark',
    font: {
      heading: 'Instrument Serif',
      body: 'General Sans',
      mono: 'JetBrains Mono',
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
