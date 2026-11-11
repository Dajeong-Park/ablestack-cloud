// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
// http://www.apache.org/licenses/LICENSE-2.0
export function decodeSmbNameContext (wire) {
  const context = wire?.getstoragesmbservicenamecontextresponse?.servicenamecontext?.context
  return context && typeof context === 'object' && !Array.isArray(context) ? context : null
}
export function decodeSmbNames (wire) {
  const rows = wire?.liststoragesmbservicenamesresponse?.servicename
  if (rows === undefined) return []
  if (!Array.isArray(rows)) throw new Error('SMB_NAME_LIST_RESPONSE_INVALID')
  return rows
}
export function smbNameParameters (mode, row, draft) {
  if (mode === 'delete') return { id: row.id }
  const value = { fqdn: String(draft.fqdn || '').trim().toLowerCase().replace(/\.$/, ''), kind: draft.kind || row?.kind || 'ALIAS' }
  if (row?.id) value.id = row.id
  if (draft.endpointid) value.endpointid = draft.endpointid
  return value
}
export function smbNameIntent (mode, row, draft) {
  const action = mode === 'delete' ? 'delete' : row?.id ? 'update' : 'create'
  return { api: action + 'StorageSmbServiceName', ...smbNameParameters(mode, row, draft) }
}
export function smbNameMessage (error) {
  const code = typeof error === 'string' ? error : error?.response?.data?.errorresponse?.errortext || error?.message || 'SMB_NAME_OBSERVATION_UNAVAILABLE'
  const messages = {
    SMB_NAME_DNS_CONFLICT: '다른 주소 또는 DNS 별칭이 등록되어 있습니다.',
    SMB_NAME_SPN_CONFLICT: '다른 AD 계정이 이 이름의 SPN을 소유하고 있습니다.',
    SMB_NAME_DNS_OWNER_CHANGED: 'DNS 객체 신원이 변경됐습니다. 소유권을 확인한 뒤 복구하세요.',
    SMB_NAME_COMPUTER_IDENTITY_CHANGED: '가입한 AD 컴퓨터 신원이 변경됐습니다.',
    SMB_NAME_AD_JOIN_REQUIRED: 'AD 가입과 SMB 서비스 적용을 먼저 완료하세요.',
    SMB_NAME_AD_RECOVERY_REQUIRED: 'AD 가입·SMB 적용 복구를 먼저 완료하세요.',
    SMB_NAME_CONFIGURATION_WRITER_ACTIVE: '현재 구성 작업을 먼저 확인·복구하세요.',
    SMB_NAME_LIFECYCLE_WRITER_ACTIVE: '서비스 수명주기 작업이 진행 중입니다.',
    SMB_NAME_CAPABILITY_REQUIRED: '서비스 이름을 지원하는 런타임으로 업데이트하세요.',
    SMB_NAME_CREDENTIALS_REQUIRED: '같은 작업 복구에 사용할 일회성 AD 인증을 입력하세요.',
    SMB_NAME_DUPLICATE: '같은 서비스 이름이 이미 등록되어 있습니다.',
    SMB_NAME_AD_AUTHENTICATION_FAILED: 'AD 인증을 확인하지 못했습니다.',
    SMB_NAME_ENDPOINT_NOT_READY: '선택한 SMB 엔드포인트의 준비 상태를 확인하세요.'
  }
  return messages[code] ? messages[code] + ' (' + code + ')' : String(code).slice(0, 1200)
}
