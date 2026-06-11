/**
 * Ambient declaration for the prebuild-generated repo manifest.
 *
 * `src/generated/repo-manifest.json` is produced by scripts/generate-manifest.js
 * (gitignored) and may be absent during a bare `tsc -b`. Declaring the module
 * keeps the dynamic import in local-loader.ts type-checkable whether or not the
 * file has been generated, without enabling repo-wide JSON resolution.
 */
declare module '*generated/repo-manifest.json' {
  const manifest: unknown;
  export default manifest;
}
