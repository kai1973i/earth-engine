/**
 * Minimal SemVer handling for plugin/core compatibility checks. Supports
 * `^`, `~`, `>=`, `<=`, `>`, `<`, `=`, exact versions and `*`, with several
 * comparators separated by whitespace. Prerelease tags are ignored.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(input: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(input.trim());
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isFinite)) return null;
  return { major, minor, patch };
}

export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function upperBound(base: Version, operator: "^" | "~"): Version {
  if (operator === "~") return { major: base.major, minor: base.minor + 1, patch: 0 };
  if (base.major > 0) return { major: base.major + 1, minor: 0, patch: 0 };
  if (base.minor > 0) return { major: 0, minor: base.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: base.patch + 1 };
}

export function satisfies(versionInput: string, rangeInput: string): boolean {
  const version = parseVersion(versionInput);
  if (!version) return false;
  const range = rangeInput.trim();
  if (range === "" || range === "*" || range === "latest") return true;

  // Supports "1.2.x" / "1.x".
  const wildcard = /^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/.exec(range);
  if (wildcard && /x|\*/.test(range)) {
    const major = Number(wildcard[1]);
    const minorRaw = wildcard[2];
    if (major !== version.major) return false;
    if (!minorRaw || minorRaw === "x" || minorRaw === "*") return true;
    return Number(minorRaw) === version.minor;
  }

  for (const comparator of range.split(/\s+/).filter(Boolean)) {
    if (!satisfiesComparator(version, comparator)) return false;
  }
  return true;
}

function satisfiesComparator(version: Version, comparator: string): boolean {
  const match = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(comparator);
  if (!match) return false;
  const operator = match[1] ?? "=";
  const base = parseVersion(match[2] ?? "");
  if (!base) return false;

  switch (operator) {
    case "^":
    case "~":
      return compareVersions(version, base) >= 0 && compareVersions(version, upperBound(base, operator)) < 0;
    case ">=":
      return compareVersions(version, base) >= 0;
    case "<=":
      return compareVersions(version, base) <= 0;
    case ">":
      return compareVersions(version, base) > 0;
    case "<":
      return compareVersions(version, base) < 0;
    default:
      return compareVersions(version, base) === 0;
  }
}
