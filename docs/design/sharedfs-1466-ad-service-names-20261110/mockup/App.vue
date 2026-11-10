<!-- Apache-2.0. Design-only mockup. Synthetic data; no API requests. -->
<template>
<a-config-provider :locale="locale">
<div class="design-root">
 <div class="design-note"><b>B · #1466 개선 UI 목업</b><span>합성 예시 · 실제 서비스/API 변경 없음</span>
  <a-button size="small" @click="dialog=''">서비스 이름</a-button><a-button size="small" @click="open('create')">추가</a-button>
  <a-button size="small" @click="open('blocked')">충돌</a-button><a-button size="small" @click="open('join')">가입 단계</a-button>
  <a-switch v-model:checked="dark" checked-children="다크" un-checked-children="라이트" />
 </div>
 <div class="shell">
  <aside><b>ABLESTACK</b><p>대시보드</p><p>컴퓨트　⌄</p><p>　가상머신</p><p>스토리지　⌄</p><div class="selected">공유 파일 시스템</div><p>네트워크</p><p>이미지</p></aside>
  <div class="workspace">
   <header><span>☰　기본 보기</span><span>AC　admin cloud</span></header>
   <a-card class="breadcrumb-card"><a-row align="middle"><a-col :span="20">
    <Breadcrumb :resource="{name:'sharedfs-ad-names-design'}"><template #end><a-button size="small" shape="round"><ReloadOutlined />업데이트</a-button></template></Breadcrumb>
   </a-col><a-col :span="4" class="right"><a-button>작업 <DownOutlined /></a-button></a-col></a-row></a-card>
   <main><ResourceLayout>
    <template #left><a-card class="resource-info"><FileTextOutlined class="resource-icon" /><h3>sharedfs-ad-names-design</h3>
     <a-badge status="success" text="사용 가능" /><dl><dt>주 IP</dt><dd>10.10.13.220 · 예시</dd><dt>프로토콜</dt><dd>NFS · SMB</dd><dt>볼륨</dt><dd>SPARSE ROOT · XFS DATA</dd><dt>AD 도메인</dt><dd>ablestack.local</dd></dl>
    </a-card></template>
    <template #right><a-card class="tab-card"><a-tabs v-model:activeKey="tab" tab-position="left">
     <a-tab-pane key="details" tab="상세"><a-list :data-source="details" size="small"><template #renderItem="{item}"><a-list-item><div class="detail"><strong>{{item[0]}}</strong><span>{{item[1]}}</span></div></a-list-item></template></a-list></a-tab-pane>
     <a-tab-pane key="capacity" tab="용량·볼륨" /><a-tab-pane key="directory" tab="공유 디렉터리" /><a-tab-pane key="nfs" tab="NFS" />
     <a-tab-pane key="smb" tab="SMB"><a-descriptions :column="1" bordered size="small"><a-descriptions-item label="인증">AD · ablestack.local · 가입됨</a-descriptions-item><a-descriptions-item label="계정">STORC1ECA707A5$ · VM당 하나</a-descriptions-item></a-descriptions><div class="toolbar spaced"><a-button @click="open('join')">AD 도메인 재가입</a-button><a-button @click="tab='names'">서비스 이름 보기</a-button></div></a-tab-pane>
     <a-tab-pane key="names" tab="SMB 서비스 이름">
      <div class="toolbar"><a-button type="primary" @click="open('create')"><PlusOutlined />서비스 이름 추가</a-button><a-button @click="notice='조회만 수행하는 예시입니다. 실제 API 호출은 없습니다.'"><ReloadOutlined />업데이트</a-button></div>
      <a-descriptions :column="2" bordered size="small">
       <a-descriptions-item label="AD 도메인">ablestack.local</a-descriptions-item><a-descriptions-item label="가입 / SMB 적용"><a-tag color="green">가입됨</a-tag><a-tag color="green">적용 확인</a-tag></a-descriptions-item>
       <a-descriptions-item label="컴퓨터 계정">STORC1ECA707A5$</a-descriptions-item><a-descriptions-item label="기본 호스트명">storc1eca707a5.ablestack.local</a-descriptions-item>
      </a-descriptions>
      <a-alert class="spaced" type="info" show-icon message="서비스 이름은 같은 SMB 서비스의 접속 이름입니다. 공유·계정 ACL·POSIX 권한은 바뀌지 않습니다." description="이름별 DNS·SPN과 관리 주체를 구분합니다. ‘구성 일치’와 실제 클라이언트 Kerberos 접속 검증은 별도 상태입니다." />
      <a-table class="names-table spaced" :columns="columns" :data-source="rows" row-key="id" size="small" :pagination="false" :scroll="{x:940}">
       <template #bodyCell="{column,record}">
        <template v-if="column.key==='fqdn'"><a @click="open('detail',record)">{{record.fqdn}}</a><div class="muted">{{record.role}}</div></template>
        <template v-if="column.key==='endpoint'"><span>{{record.endpoint}}</span><div class="muted">이 인스턴스의 검증된 주소</div></template>
        <template v-if="column.key==='dns'"><div><a-tag :color="record.base?'orange':'green'">DNS {{record.base?'미등록':'일치'}}</a-tag><span class="muted">{{record.base?'등록 전':record.external?'기존 · 보존':'Mold 생성'}}</span></div><div class="record-line"><a-tag color="green">SPN {{record.base?'기본 관측':'일치'}}</a-tag><span class="muted">{{record.base?'HOST 보존':'동일 컴퓨터'}}</span></div></template>
        <template v-if="column.key==='spn'"><a-tag color="green">{{record.base?'기본 SPN 관측':'일치'}}</a-tag><div class="muted">{{record.base?'기존 HOST 보존':'CIFS · 동일 컴퓨터'}}</div></template>
        <template v-if="column.key==='verify'"><a-tag :color="record.base?'default':'green'">{{record.base?'접속 미검증':'구성 일치'}}</a-tag><div class="muted">클라이언트 검증 별도</div></template>
        <template v-if="column.key==='actions'"><a-space :size="8"><a-button size="small" @click="open(record.base?'base':'edit',record)"><EditOutlined />{{record.base?'등록':'편집'}}</a-button><a-button v-if="!record.base" size="small" @click="open('delete',record)"><DeleteOutlined />삭제</a-button></a-space></template>
       </template>
      </a-table>
      <a-alert v-if="notice" class="spaced" type="info" :message="notice" />
     </a-tab-pane>
     <a-tab-pane key="iscsi" tab="iSCSI" /><a-tab-pane key="nvme" tab="NVMe-oF" /><a-tab-pane key="backup" tab="구성 백업" /><a-tab-pane key="runtime" tab="런타임" /><a-tab-pane key="boot" tab="부팅 복구" /><a-tab-pane key="network" tab="네트워크" /><a-tab-pane key="operations" tab="작업 내역" />
    </a-tabs></a-card></template>
   </ResourceLayout></main>
  </div>
 </div>
 <MoldDialog v-if="dialog" :visible="true" :title="title" size="xl" form-actions focus-guard @cancel="dialog=''">
  <div class="form-body">
   <a-alert type="info" show-icon message="설계 목업 · 합성 데이터 · 인증/API 요청을 보내지 않습니다." />
   <template v-if="dialog==='detail'">
    <a-descriptions class="spaced" :column="1" bordered size="small"><a-descriptions-item label="FQDN">{{selected.fqdn}}</a-descriptions-item><a-descriptions-item label="엔드포인트">{{selected.endpoint}}</a-descriptions-item><a-descriptions-item label="AD 컴퓨터">STORC1ECA707A5$ · GUID 일치</a-descriptions-item><a-descriptions-item label="DNS A">10.10.13.220 · Mold 생성</a-descriptions-item><a-descriptions-item label="SPN">cifs/{{selected.fqdn}} · Mold 생성</a-descriptions-item><a-descriptions-item label="클라이언트 접속">별도 검증 · Windows klist/Get-SmbConnection 확인</a-descriptions-item></a-descriptions>
   </template>
   <template v-else-if="dialog==='join'">
    <a-form layout="vertical" class="spaced"><a-row :gutter="16"><a-col :span="12"><a-form-item label="AD 도메인"><a-input value="ablestack.local" /></a-form-item></a-col><a-col :span="12"><a-form-item label="AD DNS 서버"><a-input value="10.10.13.247" /></a-form-item></a-col></a-row>
     <a-row :gutter="16"><a-col :span="12"><a-form-item label="AD 계정"><a-input value="ad-names-operator" autocomplete="off" /></a-form-item></a-col><a-col :span="12"><a-form-item label="비밀번호"><a-input-password placeholder="작업 시에만 사용 · 저장하지 않음" autocomplete="new-password" /></a-form-item></a-col></a-row>
     <a-form-item label="가입 후 등록할 서비스 이름 (선택)"><a-table :columns="joinColumns" :data-source="joinRows" size="small" :pagination="false"><template #bodyCell="{column,record}"><a-input v-if="column.key==='name'" v-model:value="record.name" /><a-select v-if="column.key==='endpoint'" v-model:value="record.endpoint" class="full-width"><a-select-option value="10.10.13.220:445">10.10.13.220:445</a-select-option><a-select-option value="10.10.13.221:445">10.10.13.221:445 · 예시</a-select-option></a-select></template></a-table><a-button size="small" class="spaced" @click="joinRows.push({key:joinRows.length+1,name:'',endpoint:'10.10.13.220:445'})"><PlusOutlined />이름 추가</a-button></a-form-item>
    </a-form>
    <a-steps size="small" :current="2"><a-step title="도메인 가입" description="가입됨" /><a-step title="SMB 적용" description="검증 완료" /><a-step title="서비스 이름" :status="checked?'error':'process'" :description="checked?'실패 · 추가분 원복':'별도 단계'" /></a-steps>
    <a-alert v-if="checked" class="spaced" type="warning" show-icon message="가입과 SMB 적용은 유지됐습니다. 이름 등록 단계만 복구해야 합니다." description="AD_NAMES_DNS_ACCESS_DENIED · DNS/SPN 추가분 원복 완료 · 도메인 재가입을 반복하지 않습니다." />
   </template>
   <template v-else-if="dialog==='delete'">
    <a-alert class="spaced" type="warning" show-icon message="이 작업이 생성한 DNS/SPN 항목만 제거합니다." description="기존 재사용 항목과 기본 HOST SPN·컴퓨터 계정은 보존합니다. DNS 캐시·이미 발급된 ticket·기존 SMB 세션의 즉시 종료를 의미하지 않습니다." />
    <a-table class="spaced" :columns="deleteColumns" :data-source="deleteRows" size="small" :pagination="false" />
    <a-checkbox v-model:checked="ack" class="spaced">삭제 범위와 기존 항목 보존을 확인했습니다.</a-checkbox>
    <a-form layout="vertical" class="spaced"><a-row :gutter="16"><a-col :span="12"><a-form-item label="AD 이름 관리 계정"><a-input placeholder="DNS 수정·대상 컴퓨터 SPN 권한" /></a-form-item></a-col><a-col :span="12"><a-form-item label="비밀번호"><a-input-password placeholder="저장하지 않음" autocomplete="new-password" /></a-form-item></a-col></a-row></a-form>
   </template>
   <template v-else-if="dialog==='recovery'">
    <a-alert class="spaced" type="warning" show-icon message="AD 응답 유실 · 기존 작업을 확인해야 합니다." description="새 이름을 중복 생성하지 않습니다. 같은 작업 UUID와 소유 기록으로 관측·원복합니다." />
    <a-descriptions class="spaced" :column="1" bordered size="small"><a-descriptions-item label="작업">예시 operation UUID · RECOVERY_REQUIRED</a-descriptions-item><a-descriptions-item label="단계">SPN 추가 확인 · DNS 응답 확인 필요</a-descriptions-item><a-descriptions-item label="기존 서비스">SMB/NFS 서비스 유지 · 설정·DATA 변경 없음</a-descriptions-item></a-descriptions>
    <a-form layout="vertical" class="spaced"><a-row :gutter="16"><a-col :span="12"><a-form-item label="AD 이름 관리 계정"><a-input /></a-form-item></a-col><a-col :span="12"><a-form-item label="비밀번호"><a-input-password placeholder="복구 작업에만 사용" autocomplete="new-password" /></a-form-item></a-col></a-row></a-form>
   </template>
   <template v-else>
    <a-form layout="vertical" class="spaced">
     <a-form-item label="서비스 이름 (AD 도메인 FQDN)"><a-input v-model:value="draftFqdn" :readonly="dialog==='base'" /><div class="muted">컴퓨터 계정·운영체제 호스트명을 변경하지 않습니다. CNAME·다른 도메인은 이번 범위가 아닙니다.</div></a-form-item>
     <a-form-item label="SMB 엔드포인트"><a-select v-model:value="draftEndpoint"><a-select-option value="smb-445">10.10.13.220:445 · 준비됨 · 개별 주소</a-select-option><a-select-option value="smb-alt">10.10.13.221:445 · 합성 예시</a-select-option></a-select><div class="muted">DNS A는 선택한 주소만 가리킵니다. DNS 이름은 TCP 포트를 선택하지 않으며 일반 Windows UNC는 445를 사용합니다.</div></a-form-item>
     <a-row :gutter="16"><a-col :span="12"><a-form-item label="AD 이름 관리 계정"><a-input value="ad-names-operator" autocomplete="off" /></a-form-item></a-col><a-col :span="12"><a-form-item label="비밀번호"><a-input-password placeholder="작업 중 메모리에서만 사용" autocomplete="new-password" /></a-form-item></a-col></a-row>
    </a-form>
    <a-alert type="info" show-icon message="DNS 레코드 수정과 이 컴퓨터의 SPN 수정 권한이 필요합니다." description="가입된 machine 계정만으로 가능하다고 가정하지 않습니다. 기존 DNS/SPN이 동일한 대상이면 재사용을 표시하고 자동 삭제하지 않습니다." />
    <template v-if="checked">
     <div class="section-label">사전 점검</div>
     <a-alert v-if="dialog==='blocked'" type="error" show-icon message="AD_NAMES_SPN_OWNER_CONFLICT · 다른 AD 계정의 SPN" description="변경하지 않았습니다. 기존 항목을 덮어쓰거나 가져오지 않습니다." />
     <a-alert v-else type="success" show-icon message="구성 점검 통과 · DNS/SPN 생성 전" description="기존 서비스·세션·ACL 유지. 계정 비밀번호는 기록하지 않습니다." />
     <a-table class="spaced" :columns="previewColumns" :data-source="previewRows" size="small" :pagination="false" />
     <a-checkbox v-if="dialog!=='blocked'" v-model:checked="ack" class="spaced">표시된 DNS/SPN 변경과 기존 항목 보존을 확인했습니다.</a-checkbox>
    </template>
   </template>
   <a-alert v-if="notice" class="spaced" type="info" :message="notice" />
  </div>
  <template #footer><MoldDialogActions><a-button @click="dialog=''">{{dialog==='detail'?'닫기':'취소'}}</a-button><a-button v-if="dialog!=='detail'" type="primary" :disabled="(dialog==='blocked'&&checked)||(checked&&['create','edit','base','delete'].includes(dialog)&&!ack)" @click="footerAction">{{actionLabel}}</a-button></MoldDialogActions></template>
 </MoldDialog>
</div></a-config-provider>
</template>
<script>
import koKR from 'ant-design-vue/es/locale/ko_KR'
import Breadcrumb from '@/components/widgets/Breadcrumb.vue'
import ResourceLayout from '@/layouts/ResourceLayout.vue'
import MoldDialog from '@/components/view/MoldDialog.vue'
import MoldDialogActions from '@/components/view/MoldDialogActions.vue'
import {ReloadOutlined,PlusOutlined,EditOutlined,DeleteOutlined,DownOutlined,FileTextOutlined} from '@ant-design/icons-vue'
const q=new URLSearchParams(location.search)
export default {
 components:{Breadcrumb,ResourceLayout,MoldDialog,MoldDialogActions,ReloadOutlined,PlusOutlined,EditOutlined,DeleteOutlined,DownOutlined,FileTextOutlined},
 data(){return {locale:koKR,dark:q.get('theme')==='dark',tab:'names',dialog:q.get('dialog')||'',checked:q.get('preview')==='1',ack:false,notice:'',selected:{fqdn:'files-a.ablestack.local',endpoint:'10.10.13.220:445'},draftFqdn:q.get('dialog')==='blocked'?'finance.ablestack.local':'files-new.ablestack.local',draftEndpoint:'smb-445',
  columns:[{title:'서비스 이름',key:'fqdn',width:250},{title:'엔드포인트',key:'endpoint',width:170},{title:'DNS / SPN',key:'dns',width:220},{title:'검증',key:'verify',width:140},{title:'작업',key:'actions',width:160}],
  rows:[{id:'base',fqdn:'storc1eca707a5.ablestack.local',role:'기본 이름 · 고정',endpoint:'10.10.13.220:445',base:true},{id:'one',fqdn:'files-a.ablestack.local',role:'추가 이름',endpoint:'10.10.13.220:445'},{id:'two',fqdn:'archive.ablestack.local',role:'추가 이름',endpoint:'10.10.13.221:445',external:true}],
  details:[['이름','sharedfs-ad-names-design'],['상태','Ready'],['파일 시스템','XFS'],['프로비저닝','SPARSE']],
  previewColumns:[{title:'항목',dataIndex:'kind',width:150},{title:'현재',dataIndex:'before'},{title:'변경 후',dataIndex:'after'},{title:'정리 소유권',dataIndex:'owner',width:170}],
  joinColumns:[{title:'FQDN',key:'name',width:500},{title:'엔드포인트',key:'endpoint'}],joinRows:[{key:1,name:'files-a.ablestack.local',endpoint:'10.10.13.220:445'},{key:2,name:'files-b.ablestack.local',endpoint:'10.10.13.221:445'}],
  deleteColumns:[{title:'항목',dataIndex:'kind'},{title:'값',dataIndex:'value'},{title:'삭제 시',dataIndex:'action'}],
  deleteRowsTemplate:[{key:1,kind:'DNS A · Mold 생성',value:'files-a → 10.10.13.220',action:'이 값만 제거'},{key:2,kind:'CIFS SPN · Mold 생성',value:'cifs/files-a.ablestack.local',action:'이 값만 제거'},{key:3,kind:'기본 HOST / 컴퓨터',value:'STORC1ECA707A5$',action:'보존'}]
 }},
 computed:{actionLabel(){return this.dialog==='join'&&this.checked?'이름 작업 복구':this.dialog==='recovery'?'같은 작업 확인':this.checked?'변경 적용':'사전 점검'},deleteRows(){return [{key:1,kind:this.selected.external?'DNS A · 기존 항목':'DNS A · Mold 생성',value:this.selected.fqdn+' → '+this.selected.endpoint.split(':')[0],action:this.selected.external?'보존 · 삭제 안 함':'이 값만 제거'},{key:2,kind:'CIFS SPN · Mold 생성',value:'cifs/'+this.selected.fqdn,action:'이 값만 제거'},{key:3,kind:'기본 HOST / 컴퓨터',value:'STORC1ECA707A5$',action:'보존'}]},title(){return {create:'SMB 서비스 이름 추가',base:'기본 서비스 이름 등록',edit:'SMB 서비스 이름 편집',blocked:'SMB 서비스 이름 추가',delete:'SMB 서비스 이름 삭제',join:'AD 도메인 가입',recovery:'서비스 이름 복구 확인',detail:'SMB 서비스 이름 상세'}[this.dialog]},previewRows(){return [{key:1,kind:'DNS A',before:'미등록',after:'10.10.13.220 · TTL 300',owner:'이번 작업 생성'},{key:2,kind:'CIFS SPN',before:this.dialog==='blocked'?'다른 AD 계정':'미등록',after:this.dialog==='blocked'?'변경 금지':'STORC1ECA707A5$',owner:this.dialog==='blocked'?'외부 소유 · 차단':'이번 작업 생성'},{key:3,kind:'기본 HOST / keytab',before:'현재 값',after:'그대로 유지',owner:'정리 대상 아님'}]}},
 watch:{dark:{immediate:true,handler(v){document.body.classList.toggle('dark-mode',v)}}},
 methods:{footerAction(){if(this.dialog==='join'&&this.checked)this.open('recovery');else if(this.dialog==='recovery')this.notice='같은 작업을 관측/원복하는 목업 예시 · 실제 API 요청 없음';else this.preview()},open(t,record){this.dialog=t;this.checked=false;this.ack=false;this.notice='';this.selected=record||this.rows[1];this.draftFqdn=t==='blocked'?'finance.ablestack.local':t==='create'?'files-new.ablestack.local':this.selected.fqdn;this.draftEndpoint=this.selected.endpoint.includes('13.221')?'smb-alt':'smb-445'},preview(){if(!this.checked)this.checked=true;else this.notice='목업 예시입니다. 실제 AD/SMB/API 작업은 실행하지 않았습니다.'}}
}
</script>
<style>
.design-root{min-height:100vh;color:var(--ui-text-primary);background:var(--ui-bg-page)}
.design-note{display:flex;gap:8px;align-items:center;padding:10px 16px;font-size:12px;background:var(--ui-bg-elevated);border-bottom:1px solid var(--ui-border)}.design-note>span{flex:1;color:var(--ui-text-secondary)}
.shell{display:flex;min-height:calc(100vh - 54px)}aside{width:200px;flex-shrink:0;padding:20px 16px;background:var(--ui-bg-elevated);border-right:1px solid var(--ui-border)}aside>b{font-size:26px}aside p{margin:26px 8px}.selected{padding:12px;color:var(--ui-link);background:var(--ui-bg-selected);border-radius:4px}
.workspace{flex:1;min-width:0}header{height:64px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:var(--ui-bg-elevated);border-bottom:1px solid var(--ui-border)}.breadcrumb-card{border-radius:0}.breadcrumb-card>.ant-card-body{padding:16px 24px}.right{text-align:right}main{padding:16px 24px}
.resource-info h3{margin:16px 0;color:var(--ui-text-primary);overflow-wrap:anywhere}.resource-icon{font-size:36px;color:var(--ui-link)}dt{font-weight:600;margin:16px 0 4px}dd{margin:0}.tab-card>.ant-card-body{padding:16px}.tab-card .ant-tabs-nav{min-width:124px}
.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px}.spaced{margin-top:16px}.muted{font-size:12px;color:var(--ui-text-secondary);margin-top:4px}.record-line{margin-top:6px}.section-label{font-weight:600;margin:20px 0 12px}.names-table .ant-table-cell{white-space:nowrap}.form-body{color:var(--ui-text-primary)}.full-width{width:100%}.form-body .ant-form-item{margin-bottom:16px}.detail{display:flex;flex-direction:column;gap:8px;padding:4px 0}.detail strong{color:var(--ui-text-secondary)}
.design-root .ant-btn-primary,.mold-dialog .ant-btn-primary{background:#096dd9;border-color:#096dd9;color:white}
@media(max-width:1000px){aside{display:none}main{padding:16px}.design-note>span{display:none}}
</style>
