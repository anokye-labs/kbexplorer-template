/** Tiny `--flag value` / `--flag=value` / repeatable-flag parser for actor CLIs. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key, val;
      if (eq !== -1) { key = a.slice(2, eq); val = a.slice(eq + 1); }
      else { key = a.slice(2); val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
      if (key in out) out[key] = Array.isArray(out[key]) ? [...out[key], val] : [out[key], val];
      else out[key] = val;
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** A short, sortable, collision-resistant nonce for actor-created entities. */
export function nonce() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(2, 14);
}
