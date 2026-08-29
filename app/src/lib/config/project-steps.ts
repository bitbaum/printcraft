/**
 * The steps a project actually moves through in this app. One list, so the
 * step nav and the dashboard badge cannot disagree about where a project is.
 */
export const PROJECT_STEPS = [
  { id: 'figures', label: 'Figures', href: 'figures', doneLabel: 'Figures added' },
  { id: 'style', label: 'Style', href: 'style', doneLabel: 'Style chosen' },
  { id: 'surface', label: 'Surface', href: 'surface', doneLabel: 'Surface set' },
  { id: 'compose', label: 'Compose', href: 'compose', doneLabel: 'Composed' },
  { id: 'export', label: 'Export', href: 'export', doneLabel: 'Exported' },
] as const;

export type ProjectStepId = (typeof PROJECT_STEPS)[number]['id'];

/** Shown when no step is finished yet. */
export const NOT_STARTED_LABEL = 'Not started';
