/**
 * Local content loader for kbexplorer.
 *
 * In local mode, imports the pre-built repo-manifest.json and produces the same
 * KBNode[] and KBConfig as the API-based parser — but with zero runtime API calls.
 */
import yaml from 'yaml';
import type { KBConfig, KBGraph } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { buildGraph } from '@anokye-labs/kbexplorer-engine';
import { ManifestSource, type RepoManifest } from '@anokye-labs/kbexplorer-engine/sources';
import { loadKnowledgeBase } from './loader';
import type { EngineEnv } from '@anokye-labs/kbexplorer-engine';
import { browserWasmLocateFile } from './store/browser-wasm';

// ── Manifest Types ─────────────────────────────────────────

/**
 * `RepoManifest` was relocated to `@anokye-labs/kbexplorer-engine`'s
 * `./sources` subpath in anokye-labs/kbexplorer-template#472, slice 4/5
 * STEP B, because `ManifestSource`'s constructor (also moved) takes one.
 * The manifest-generation script and this local (manifest-import) loader
 * remain template-side; only the interface itself travels — re-exported
 * here (thin re-export idiom, same as `access.ts`/`NodeLayer`) so every
 * existing template import path (`'../local-loader'` /
 * `'../../src/engine/local-loader'`) keeps resolving unchanged.
 */
export type { RepoManifest };

// ── Manifest Loading ───────────────────────────────────────

let _manifestPromise: Promise<RepoManifest | null> | null = null;

async function loadManifest(): Promise<RepoManifest | null> {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = (async () => {
    try {
      const mod = await import('../generated/repo-manifest.json');
      return (mod.default ?? mod) as RepoManifest;
    } catch {
      return null;
    }
  })();
  return _manifestPromise;
}

// ── Mode Detection ─────────────────────────────────────────

/** Check if local mode is active (requires explicit VITE_KB_LOCAL=true). */
export function isLocalMode(env?: EngineEnv): boolean {
  return env?.VITE_KB_LOCAL === 'true';
}

/** Async check — same as isLocalMode but async for hook compatibility. */
export async function detectLocalMode(env?: EngineEnv): Promise<boolean> {
  return isLocalMode(env);
}

// ── Local Config ───────────────────────────────────────────

/** Derive the resolved KBConfig from an in-memory manifest (pure; no I/O). */
export function buildConfigFromManifest(manifest: RepoManifest | null): KBConfig {
  if (!manifest?.configRaw) return { ...DEFAULT_CONFIG };

  try {
    const parsed = yaml.parse(manifest.configRaw) as Partial<KBConfig>;
    const config = { ...DEFAULT_CONFIG, ...parsed, source: DEFAULT_CONFIG.source };
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function loadLocalConfig(): Promise<KBConfig> {
  return buildConfigFromManifest(await loadManifest());
}

// ── Full Local Load ────────────────────────────────────────

/**
 * Provider-based loader using the orchestrator pipeline.
 *
 * 1. Registers FilesProvider, AuthoredProvider, WorkProvider
 * 2. Collects nodes from providers in dependency order
 * 3. Applies README creation + cross-linking transforms not yet in providers
 * 4. Builds the final graph
 */
async function loadLocalKnowledgeBaseV2(env?: EngineEnv): Promise<{
  graph: KBGraph;
  config: KBConfig;
  themeFileRaw: string | null;
}> {
  const manifest = await loadManifest();
  if (!manifest) {
    const config = await loadLocalConfig();
    const graph = buildGraph([], []);
    return { graph, config, themeFileRaw: null };
  }

  const config = buildConfigFromManifest(manifest);
  return buildKnowledgeBaseFromManifest(manifest, config, env);
}

/**
 * Build the local-mode KBGraph from an in-memory manifest + resolved config.
 * Extracted so a committed manifest fixture can drive a hermetic golden
 * snapshot (Phase 0) without depending on the ambient generated manifest.
 */
export async function buildKnowledgeBaseFromManifest(
  manifest: RepoManifest,
  config: KBConfig,
  env?: EngineEnv,
): Promise<{ graph: KBGraph; config: KBConfig; themeFileRaw: string | null }> {
  const result = await loadKnowledgeBase(
    new ManifestSource(manifest, config),
    config,
    env,
    {
      ...(typeof env?.BASE_URL === 'string' ? { importBaseUrl: env.BASE_URL } : {}),
      graphStore: { locateFile: browserWasmLocateFile },
    },
  );
  return { ...result, themeFileRaw: manifest.themeFileRaw ?? null };
}

export async function loadLocalKnowledgeBase(env?: EngineEnv): Promise<{
  graph: KBGraph;
  config: KBConfig;
  themeFileRaw: string | null;
}> {
  return loadLocalKnowledgeBaseV2(env);
}
