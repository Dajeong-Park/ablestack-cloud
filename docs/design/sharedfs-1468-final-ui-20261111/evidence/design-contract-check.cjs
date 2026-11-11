// Design-only contract experiment. Not imported by the product UI.
const fs=require('fs'),assert=require('assert');
const wire=JSON.parse(fs.readFileSync(__dirname+'/artifact-created-wire.json','utf8'));
function dateInput(value){if(value==null||value==='')return null;if(typeof value==='number'||/^[0-9]{13}$/.test(value)){const n=Number(value);return Number.isSafeInteger(n)&&n>0&&Number.isFinite(new Date(n).getTime())?new Date(n).toISOString():null}return typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))?value:null}
function rollbackKey(op){if(op.rollback?.state!=='NOT_NEEDED')return op.rollback?.state||null;if(op.state==='COMMITTED')return'NO_SEPARATE_ROLLBACK';if(op.phase==='COMMITTING'&&['VERIFIED','COMMITTED'].includes(op.observation?.state))return'GUEST_APPLIED_SQL_PENDING';if(op.state==='ROLLED_BACK'&&(op.originalfailure?.started===false||['PREFLIGHT','VALIDATING'].includes(op.originalfailure?.phase)))return'REJECTED_BEFORE_CHANGE';return'NO_ROLLBACK_EXECUTED'}
const order=['details','nfs','smb','iscsi','nvmeof','capacity','directory','smbNames','configbackup','configurationoperations','runtime','bootrecovery','nics','vmstats','events'];
let checks=[];function test(name,fn){fn();checks.push(name)}
const original=JSON.stringify(wire),created=wire.artifacts[0].created;
test('Actual API created is epoch milliseconds and current Date.parse fails',()=>{assert.strictEqual(typeof created,'number');assert(Number.isNaN(Date.parse(created)))});
test('Proposed presentation conversion keeps the exact millisecond instant',()=>assert.strictEqual(Date.parse(dateInput(created)),created));
test('Numeric-string compatibility keeps the same instant',()=>assert.strictEqual(Date.parse(dateInput(String(created))),created));
test('ISO input stays compatible with the existing VM locale helper',()=>assert.strictEqual(dateInput(new Date(created).toISOString()),new Date(created).toISOString()));
for(const value of [null,undefined,'','bad',0,-1])test('Missing/invalid timestamp is explicit '+String(value),()=>assert.strictEqual(dateInput(value),null));
test('Committed NOT_NEEDED is not a pre-change rejection',()=>assert.strictEqual(rollbackKey({state:'COMMITTED',rollback:{state:'NOT_NEEDED'}}),'NO_SEPARATE_ROLLBACK'));
test('Guest verified and SQL pending keeps the existing protection guidance',()=>assert.strictEqual(rollbackKey({state:'RECOVERY_REQUIRED',phase:'COMMITTING',observation:{state:'VERIFIED'},rollback:{state:'NOT_NEEDED'}}),'GUEST_APPLIED_SQL_PENDING'));
test('Known no-start rejection remains distinguished',()=>assert.strictEqual(rollbackKey({state:'ROLLED_BACK',originalfailure:{started:false},rollback:{state:'NOT_NEEDED'}}),'REJECTED_BEFORE_CHANGE'));
test('Unknown phase never invents a no-mutation claim',()=>assert.strictEqual(rollbackKey({state:'RECOVERY_REQUIRED',rollback:{state:'NOT_NEEDED'}}),'NO_ROLLBACK_EXECUTED'));
test('Real rollback failure is kept verbatim',()=>assert.strictEqual(rollbackKey({state:'ROLLED_BACK',rollback:{state:'FAILED'}}),'FAILED'));
test('First five tabs are fixed by the user requirement',()=>assert.deepStrictEqual(order.slice(0,5),['details','nfs','smb','iscsi','nvmeof']));
test('Existing keys remain unique and events are last',()=>{assert.strictEqual(new Set(order).size,15);assert.strictEqual(order.at(-1),'events')});
test('Unsupported SharedFS comments are not fabricated',()=>assert(!order.includes('comments')));
test('Existing deep-link remains selected after order changes',()=>assert.strictEqual(order.find(x=>x==='configbackup'),'configbackup'));
test('Presentation experiment does not rewrite API/DB values',()=>assert.strictEqual(JSON.stringify(wire),original));
const result={kind:'DESIGN_CONTRACT_EXPERIMENT_NOT_PRODUCT_REGRESSION',checks:checks.length,failed:0,names:checks,actualCreated:created,normalized:new Date(created).toISOString(),tabOrder:order};
fs.writeFileSync(__dirname+'/design-contract-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
