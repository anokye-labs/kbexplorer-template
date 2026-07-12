/**
 * Versioning for the **view (render) contract**.
 *
 * `VIEW_API_VERSION` is bumped **independently** of core's `PROVIDER_API_VERSION`:
 * the data-side provider contract and the UX-stack render contract evolve on
 * their own cadences. A provider's `./views` entry may declare the view-contract
 * version it was authored against so a render-capable host can guard against
 * drift before mounting it, exactly mirroring core's
 * `checkProviderCompatibility` semantics.
 */

/**
 * Current version of the view (render) contract — the surface a provider's
 * `./views` entry (viewers + block renderers + {@link ProviderViews}) is authored
 * against. Versioned independently of core's `PROVIDER_API_VERSION`.
 *
 * Semantics (semver): a same-major version is compatible; a different major is
 * breaking. A provider may not require a newer minor than the host supports.
 */
export const VIEW_API_VERSION = '1.0.0' as const;

/** Result of a {@link checkViewCompatibility} check. */
export interface ViewCompatibility {
  /** Whether the render half is safe for the host to mount. */
  compatible: boolean;
  /** Human-readable reason when `compatible` is `false`. */
  reason?: string;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/** Parse the `major.minor.patch` core of a semver string; ignores pre-release. */
function parseSemVer(version: string): SemVer | null {
  const match = /^\s*(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Validate a render half's declared view-contract version against a host's
 * supported version, returning a structured verdict instead of throwing.
 *
 * Pure: no I/O, no side effects. A host uses this to guard a provider's `./views`
 * entry before mounting its contributions, surfacing the `reason` and skipping
 * the render half rather than crashing.
 *
 * Rules (mirroring core's `checkProviderCompatibility`):
 *   - An `undefined` declared version makes no claim and passes (the guard is
 *     opt-in).
 *   - A malformed version string is rejected.
 *   - A different major version is rejected; a same-major version that requires a
 *     newer minor than the host supports is rejected.
 *
 * @param declared The view-contract version the render half targets (semver), or
 *   `undefined` to make no claim.
 * @param host The view-contract version the host implements; defaults to
 *   {@link VIEW_API_VERSION}.
 */
export function checkViewCompatibility(
  declared: string | undefined,
  host: string = VIEW_API_VERSION,
): ViewCompatibility {
  if (declared === undefined) return { compatible: true };

  const target = parseSemVer(declared);
  if (!target) {
    return {
      compatible: false,
      reason: `declares a malformed view API version "${declared}" (expected semver like "${host}")`,
    };
  }

  const supported = parseSemVer(host);
  if (supported) {
    if (target.major !== supported.major) {
      return {
        compatible: false,
        reason: `targets view API v${declared} but the host supports v${host} (incompatible major version)`,
      };
    }
    if (target.minor > supported.minor) {
      return {
        compatible: false,
        reason: `targets view API v${declared} but the host only supports up to v${host} (newer minor than host)`,
      };
    }
  }

  return { compatible: true };
}
