/**
 * Remote content loader for kbexplorer.
 *
 * Thin entrypoint over the unified loader (Phase 4 / F4 #318): constructs a
 * {@link GitHubApiSource} for the requested resolution preset and delegates to
 * `loadKnowledgeBase`. All fetch logic now lives on the source.
 *
 * Resolution presets control how much data the source fetches:
 * - summary: issues + README (fast, minimal API usage)
 * - standard: issues + PRs + README + tree + authored content
 * - full: standard + commits
 */
import type { KBGraph, KBConfig, SourceConfig } from '../types'
import { DEFAULT_CONFIG } from '../types'
import { GitHubApiSource, type ResolutionPreset } from './sources/github-api-source'
import { loadKnowledgeBase } from './loader'
import type { EngineEnv } from './env'

export type { ResolutionPreset }

/**
 * Load the knowledge base from live GitHub API data using the provider pipeline.
 */
export async function loadRemoteKnowledgeBase(
  sourceOverride?: SourceConfig,
  preset: ResolutionPreset = 'standard',
  env?: EngineEnv,
): Promise<{ graph: KBGraph; config: KBConfig; themeFileRaw: string | null }> {
  const source = sourceOverride ?? DEFAULT_CONFIG.source
  const ghSource = new GitHubApiSource(source, preset, env)
  const [config, themeFileRaw] = await Promise.all([
    ghSource.resolveConfig(),
    ghSource.resolveThemeFileRaw(),
  ])
  const result = await loadKnowledgeBase(ghSource, config, env)
  return { ...result, themeFileRaw: themeFileRaw ?? null }
}
