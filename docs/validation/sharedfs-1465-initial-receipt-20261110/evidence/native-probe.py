# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
import pathlib,json,sys,tempfile,shutil,hashlib
source=pathlib.Path('/var/lib/ablestack-storage/configuration-operations/fd68bdfb-194f-4130-9ecf-748f1b3caca2/bad6fb4b-bc9c-4774-bc4c-11065767c274')
protected=[pathlib.Path('/etc/ablestack-storage/desired-state/directory-policy.json'),pathlib.Path('/etc/samba/smb.conf'),source/'status.json']
stamps={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
with tempfile.TemporaryDirectory(prefix='issue1465-initial-',dir='/run') as temp:
 root=pathlib.Path(temp);mod=root/'modules';mod.mkdir()
 shutil.copy2('/run/issue1465-initial-transaction.py',mod/'configuration_transaction.py')
 sys.path[:0]=[str(mod),'/opt/ablestack/storage-runtime/current/lib/ablestack-storage']
 import configuration_transaction as tx
 calls=[]
 class ReadOnlyAppliedAdapter(tx.RuntimeAdapter):
  def preflight(self,payload):pass # accepted live request; this probe tests response assembly only
  def snapshot(self,payload):
   for name in ['request.json','before.json','runner-result.json','pathbindings.json']:
    shutil.copy2(source/name,self.private/name)
  def apply(self,commands):
   calls.append(1) # guest is already applied; never reapply live configuration in this probe
  def finalize_paths(self):pass # no live mount registry mutation
 request=json.loads((source/'request.json').read_text())
 journal=root/'operations';directory=journal/request['instanceUuid'];directory.mkdir(parents=True)
 tx.atomic_json(directory/'revision.json',{'revision':request['baseRevision']})
 transaction=tx.Transaction(journal,ReadOnlyAppliedAdapter)
 initial=transaction.execute('apply',request)
 assert initial['state']=='VERIFIED' and initial.get('directoryAclReceipts')
 private=directory/request['operationid']
 assert json.loads((private/'status.json').read_text())['directoryAclReceipts']==initial['directoryAclReceipts']
 for action in ['apply','resume','commit','resume']:
  result=transaction.execute(action,request)
  assert result['directoryAclReceipts']==initial['directoryAclReceipts']
 assert transaction.show(request)['directoryAclReceipts']==initial['directoryAclReceipts']
 assert len(calls)==1
 assert all(hashlib.sha256(pathlib.Path(k).read_bytes()).hexdigest()==v for k,v in stamps.items())
 print(json.dumps({'kind':'actual-SystemVM-Transaction.execute-immediate-response','applyIsReadOnlyReplayOfAlreadyAppliedGuest':True,'nativeVerify':True,'liveFilesUnchanged':True,'initialApply':initial,'duplicateApplyCalls':0,'savedAndAllSuccessResponsesMatch':True}))
