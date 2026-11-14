import { vmDeletionReason, vmDeletionScope, readVmDeletionTarget } from '@/utils/vmDeletion'
import { getAPI } from '@/api'
jest.mock('@/api', () => ({ getAPI: jest.fn() }))
const getters = { apis: { listVirtualMachines: {}, destroyVirtualMachine: {}, expungeVirtualMachine: {} }, userInfo: { id: 'admin', roletype: 'Admin' }, features: {} }
const row = { id: 'vm-a', state: 'Stopped', deleteprotection: false }
const action = { api: 'destroyVirtualMachine' }
test.each([
  [{ deleteprotection: true }, 'message.vm.delete.protected'],
  [{ deleteprotection: undefined }, 'message.vm.delete.unknown'],
  [{ state: 'Expunging' }, 'message.vm.delete.state'],
  [{ state: 'Running', hostcontrolstate: 'Offline' }, 'message.vm.delete.host'],
  [{ clonefaststatus: 'running' }, 'message.sharedmountpoint.clone.flatten.in.progress'],
  [{ clonefastphase: 'source_ready' }, 'message.sharedmountpoint.clone.flatten.in.progress'],
  [{ activebackupstatus: 'BackingUp' }, 'message.backup.in.progress']
])('menu and submission policy rejects %p', (patch, reason) => {
  expect(vmDeletionReason({ ...row, ...patch }, action, getters)).toBe(reason)
})
test('existing action guards and permissions are retained', () => {
  expect(vmDeletionReason(row, { ...action, disabled: () => true }, getters)).toBe('message.vm.delete.busy')
  expect(vmDeletionReason(row, { ...action, show: () => false }, getters)).toBe('message.vm.delete.state')
  expect(vmDeletionReason(row, action, { ...getters, apis: {} })).toBe('message.vm.delete.permission')
  expect(vmDeletionReason(row, action, getters)).toBe('')
  expect(vmDeletionReason({ ...row, state: 'Destroyed' }, { api: 'expungeVirtualMachine' }, getters)).toBe('')
})
test('fresh reads are UUID- and project-scoped and reject incomplete or moved targets', async () => {
  const target = { ...row, projectid: 'project-a' }
  const store = { getters }
  getAPI.mockResolvedValue({ listvirtualmachinesresponse: { count: 1, virtualmachine: [{ ...target }] } })
  await expect(readVmDeletionTarget(target, store)).resolves.toEqual(target)
  expect(getAPI.mock.calls[0][1]).toEqual({ id: row.id, listall: true, details: 'all', projectid: 'project-a' })
  getAPI.mockResolvedValue({ listvirtualmachinesresponse: { count: 1, virtualmachine: [{ ...row, projectid: 'project-b' }] } })
  await expect(readVmDeletionTarget(target, store)).rejects.toThrow('message.vm.delete.context')
})
test('security scope changes when session, role, project or route changes', () => {
  const route = { fullPath: '/vnfapp/a' }
  const store = { getters, state: { user: { token: 'session-a' } } }
  const first = vmDeletionScope(route, store)
  expect(vmDeletionScope(route, { ...store, state: { user: { token: 'session-b' } } })).not.toBe(first)
  expect(vmDeletionScope(route, { ...store, getters: { ...getters, project: { id: 'b' } } })).not.toBe(first)
  expect(vmDeletionScope({ fullPath: '/vnfapp/b' }, store)).not.toBe(first)
  expect(vmDeletionScope(route, { ...store, getters: { ...getters, userInfo: { ...getters.userInfo, roletype: 'User' } } })).not.toBe(first)
})
