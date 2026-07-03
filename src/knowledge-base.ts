import type { KBConfig, KBGraph, SourceConfig } from './types';
import { loadLocalKnowledgeBase as loadLocalKnowledgeBaseEngine } from './engine/local-loader';
import { loadRemoteKnowledgeBase as loadRemoteKnowledgeBaseEngine, type ResolutionPreset } from './engine/remote-loader';
import type { EngineEnv } from './engine/env';
import { mergeExternalTheme, parseExternalTheme } from './theme/externalTheme';

export type { ResolutionPreset } from './engine/remote-loader';

export interface KnowledgeBaseLoadResult {
  graph: KBGraph;
  config: KBConfig;
  themeFileRaw: string | null;
}

function applyExternalTheme(config: KBConfig, themeFileRaw: string | null | undefined): KBConfig {
  if (!themeFileRaw) return config;

  const parsed = parseExternalTheme(themeFileRaw);
  if (!parsed) return config;

  return {
    ...config,
    theme: mergeExternalTheme(config.theme ?? ({} as KBConfig['theme']), parsed),
  };
}

export async function loadLocalKnowledgeBase(env: EngineEnv = import.meta.env): Promise<KnowledgeBaseLoadResult> {
  const result = await loadLocalKnowledgeBaseEngine(env);
  return {
    ...result,
    config: applyExternalTheme(result.config, result.themeFileRaw),
  };
}

export async function loadRemoteKnowledgeBase(
  sourceOverride?: SourceConfig,
  preset: ResolutionPreset = 'standard',
  env: EngineEnv = import.meta.env,
): Promise<KnowledgeBaseLoadResult> {
  const result = await loadRemoteKnowledgeBaseEngine(sourceOverride, preset, env);
  return {
    ...result,
    config: applyExternalTheme(result.config, result.themeFileRaw),
  };
}
