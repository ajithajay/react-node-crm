// Condition evaluation lives in @saasly/shared (pure) so the api's record-event dispatch and the
// worker's FILTER/IF_ELSE handlers evaluate identically.
export { evaluateConditions } from '@saasly/shared';
