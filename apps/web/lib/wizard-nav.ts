/**
 * Resolve the wizard step URLs based on the current pathname. The same three
 * wizard pages back two URL prefixes:
 *
 *   /create/{details,zone,pay}                 — new campaign
 *   /campaigns/<id>/edit/{details,zone,pay}    — editing a draft
 *
 * Both sets render the same component; the prefix is just routing. This
 * helper means navigation buttons stay inside whichever prefix the user
 * started from.
 */
export type WizardStep = 'details' | 'zone' | 'pay';

export function wizardPath(currentPathname: string, step: WizardStep): string {
  const m = currentPathname.match(/^\/campaigns\/([^/]+)\/edit/);
  if (m) return `/campaigns/${m[1]}/edit/${step}`;
  return `/create/${step}`;
}
