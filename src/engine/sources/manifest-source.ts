/**
 * ManifestSource (Phase 4 / F4 #320).
 *
 * A read-only {@link RepoSource} backed by a pre-built `repo-manifest.json`.
 * Every resource it retrieves carries exactly `['read']` — a manifest is a
 * frozen snapshot, so nothing can be written or staged through it. There is no
 * staging area (and therefore no `staging-area` link): staging is a Git/GitHub
 * concern, absent from a static manifest.
 */
import type { Affordance, Resource, ResourceQuery } from '@anokye-labs/kbexplorer-core';
import type { KBConfig } from '../../types';
import type { GHTreeItem } from '../../api';
import { globToRegex } from '../glob';
import type { RepoManifest } from '../local-loader';
import type { RepoData, RepoSource } from './repo-data';

export class ManifestSource implements RepoSource {
  readonly id = 'manifest';
  readonly name = 'Repo Manifest';
  /** A manifest is a frozen snapshot — read is the only possible affordance. */
  readonly possibleAffordances: Affordance[] = ['read'];

  private readonly manifest: RepoManifest;
  private readonly config: KBConfig;

  constructor(manifest: RepoManifest, config: KBConfig) {
    this.manifest = manifest;
    this.config = config;
  }

  async getRepoData(): Promise<RepoData> {
    const manifest = this.manifest;
    const listFiles = async (pattern: string): Promise<string[]> => {
      const regex = globToRegex(pattern);
      return Object.keys(manifest.nodemapFiles ?? {}).filter(p => regex.test(p));
    };

    return {
      repo: this.config.source.repo,
      tree: manifest.tree as GHTreeItem[],
      authoredContent: manifest.authoredContent,
      nodemapRaw: manifest.nodemapRaw ?? null,
      nodemapFiles: manifest.nodemapFiles,
      nodemapDirs: manifest.nodemapDirs as Record<string, GHTreeItem[]> | undefined,
      listFiles,
      issues: manifest.issues,
      pullRequests: manifest.pullRequests,
      commits: manifest.commits,
      branches: manifest.branches ?? [],
      repoMetadata: manifest.repoMetadata ?? null,
      releases: manifest.releases ?? [],
      structuralFiles: manifest.structuralFiles ?? {},
      structuredNodeMapRaw: manifest.structuredNodeMapRaw ?? null,
      contentModel: manifest.contentModel ?? null,
      readme: manifest.readme,
    };
  }

  /**
   * Read-only resource surface. Files (tree blobs/trees) and issues are
   * retrievable; every resource is afforded `['read']` and links only to
   * itself. No write/stage, no staging area.
   */
  async retrieve(query: ResourceQuery): Promise<Resource[]> {
    const kind = query.kind;
    const out: Resource[] = [];

    if (!kind || kind === 'file' || kind === 'tree') {
      for (const item of this.manifest.tree) {
        if (kind === 'file' && item.type !== 'blob') continue;
        if (kind === 'tree' && item.type !== 'tree') continue;
        out.push(this.fileResource(item));
      }
    }
    if (!kind || kind === 'issue') {
      for (const issue of this.manifest.issues) {
        out.push(this.issueResource(issue.number, issue.title));
      }
    }
    return out;
  }

  async get(href: string): Promise<Resource | undefined> {
    const all = await this.retrieve({});
    return all.find(r => r.href === href);
  }

  private fileResource(item: { path: string; type: 'blob' | 'tree' }): Resource {
    return {
      href: `git://${this.config.source.repo}/${item.path}`,
      kind: item.type === 'tree' ? 'tree' : 'file',
      affordances: ['read'],
      links: [{ rel: 'self', href: `git://${this.config.source.repo}/${item.path}` }],
      body: { path: item.path },
    };
  }

  private issueResource(number: number, title: string): Resource {
    return {
      href: `github://${this.config.source.repo}/issues/${number}`,
      kind: 'issue',
      affordances: ['read'],
      links: [{ rel: 'self', href: `github://${this.config.source.repo}/issues/${number}` }],
      body: { number, title },
    };
  }
}
