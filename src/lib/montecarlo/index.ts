export { collectMetrics, gini } from './metrics';
export type { WorldMetrics, Distribution } from './metrics';
export { detectPathologies, firedPathologies } from './pathology';
export type { PathologyFlag } from './pathology';
export { runBatch, runWorld, formatReport } from './runner';
export type { BatchOptions, BatchResult, BatchSummary } from './runner';
