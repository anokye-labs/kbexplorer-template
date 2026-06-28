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

export type { ResolutionPreset }

/**
 * Load the knowledge base from live GitHub API data using the provider pipeline.
 */
export async function loadRemoteKnowledgeBase(
  sourceOverride?: SourceConfig,
  preset: ResolutionPreset = 'standard',
): Promise<{ graph: KBGraph; config: KBConfig }> {
  const source = sourceOverride ?? DEFAULT_CONFIG.source
  const ghSource = new GitHubApiSource(source, preset)
  const config = await ghSource.resolveConfig()
  return loadKnowledgeBase(ghSource, config)
}
