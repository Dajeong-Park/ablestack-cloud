// Licensed under the Apache License, Version 2.0. See the NOTICE file.
// Read-only presentation adapters. Do not normalize or mutate stored configuration.
export function sharedfsDateInput (value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' || (typeof value === 'string' && /^[0-9]{13}$/.test(value))) {
    const milliseconds = Number(value)
    return Number.isSafeInteger(milliseconds) && milliseconds > 0 && Number.isFinite(new Date(milliseconds).getTime())
      ? new Date(milliseconds).toISOString() : null
  }
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? value : null
}

export function sharedfsRollbackKey (operation) {
  const state = operation?.rollback?.state
  if (state !== 'NOT_NEEDED') return String(state || 'UNKNOWN').toLowerCase()
  if (operation.state === 'COMMITTED') return 'no_separate_rollback'
  if (operation.phase === 'COMMITTING' && ['VERIFIED', 'COMMITTED'].includes(operation.observation?.state)) return 'guest.applied.sql.pending'
  if (operation.state === 'ROLLED_BACK' && (operation.originalfailure?.started === false ||
    ['PREFLIGHT', 'VALIDATING'].includes(operation.originalfailure?.phase))) return 'rejected_before_change'
  return 'not_executed'
}
