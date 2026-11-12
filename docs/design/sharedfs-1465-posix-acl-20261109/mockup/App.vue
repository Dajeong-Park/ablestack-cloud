<!-- Apache-2.0. Design mockup with synthetic data only. -->
<template>
<a-config-provider :locale="locale">
<div class="design-root">
  <div class="design-note">
    <b>B · #1465 개선 UI 목업</b><span>합성 데이터 · 실제 서비스 변경 없음</span>
    <a-button size="small" @click="dialog = ''">목록</a-button>
    <a-button size="small" @click="open('edit')">정책 편집</a-button>
    <a-button size="small" @click="open('blocked')">충돌 예시</a-button>
    <a-switch v-model:checked="dark" checked-children="다크" un-checked-children="라이트" />
  </div>
  <div class="shell">
    <aside><b>ABLESTACK</b><p>대시보드</p><p>컴퓨트　⌄</p><p>　가상머신</p><p>스토리지　⌄</p>
      <div class="selected">공유 파일 시스템</div><p>네트워크</p><p>이미지</p></aside>
    <div class="workspace">
      <header><span>☰　기본 보기</span><span>AC　admin cloud</span></header>
      <a-card class="breadcrumb-card">
        <a-row align="middle"><a-col :span="20">
          <Breadcrumb :resource="{ name: 'sharedfs-posix-design' }">
            <template #end><a-button size="small" shape="round"><ReloadOutlined />업데이트</a-button></template>
          </Breadcrumb>
        </a-col><a-col :span="4" class="right"><a-button>작업 <DownOutlined /></a-button></a-col></a-row>
      </a-card>
      <main><ResourceLayout>
        <template #left><a-card class="resource-info">
          <FileTextOutlined class="resource-icon" /><h3>sharedfs-posix-design</h3>
          <a-badge status="success" text="사용 가능" />
          <dl><dt>주 IP</dt><dd>10.10.13.215 · 예시</dd><dt>파일 시스템</dt><dd>XFS</dd>
            <dt>볼륨</dt><dd>DATA 2 GiB · SPARSE</dd><dt>프로토콜</dt><dd>NFS · SMB</dd></dl>
        </a-card></template>
        <template #right><a-card class="tab-card">
          <a-tabs v-model:activeKey="tab" tab-position="left">
            <a-tab-pane key="details" tab="상세">
              <a-list :data-source="details" size="small">
                <template #renderItem="{ item }"><a-list-item><div class="detail"><strong>{{ item[0] }}</strong><span>{{ item[1] }}</span></div></a-list-item></template>
              </a-list>
            </a-tab-pane>
            <a-tab-pane key="capacity" tab="용량·볼륨" />
            <a-tab-pane key="directory" tab="공유 디렉터리">
              <div class="toolbar">
                <a-button type="primary" @click="open('register')"><PlusOutlined />기존 디렉터리 등록</a-button>
                <a-button><ReloadOutlined />업데이트</a-button>
              </div>
              <a-alert type="info" show-icon message="같은 물리 경로의 NFS·SMB는 공통 POSIX 정책을 사용합니다."
                description="프로토콜별 접근 ACL과 POSIX 권한을 모두 충족해야 접근할 수 있습니다." />
              <a-table :columns="columns" :data-source="rows" row-key="path" :pagination="false" size="small" :scroll="{ x: 880 }">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'path'"><a @click="open('edit')">{{ record.path }}</a><div class="muted">SPARSE DATA · 2 GiB</div></template>
                  <template v-if="column.key === 'refs'"><a-tag>NFS · team</a-tag><a-tag>SMB · team</a-tag></template>
                  <template v-if="column.key === 'state'"><a-tag color="green">일치</a-tag></template>
                  <template v-if="column.key === 'actions'"><a-space :size="8">
                    <a-button size="small" @click="open('edit')"><EditOutlined />편집</a-button>
                    <a-dropdown :trigger="['click']"><a-button size="small">더 보기 <DownOutlined /></a-button>
                      <template #overlay><a-menu><a-menu-item @click="open('remove')">정책 등록 해제</a-menu-item><a-menu-item @click="open('clear')">POSIX ACL 항목 제거</a-menu-item></a-menu></template>
                    </a-dropdown>
                  </a-space></template>
                </template>
              </a-table>
            </a-tab-pane>
            <a-tab-pane key="nfs" tab="NFS" /><a-tab-pane key="smb" tab="SMB" />
            <a-tab-pane key="iscsi" tab="iSCSI" /><a-tab-pane key="nvme" tab="NVMe-oF" />
            <a-tab-pane key="backup" tab="구성 백업" /><a-tab-pane key="runtime" tab="런타임" />
            <a-tab-pane key="boot" tab="부팅 복구" /><a-tab-pane key="network" tab="네트워크" />
            <a-tab-pane key="operations" tab="작업 내역" />
          </a-tabs>
        </a-card></template>
      </ResourceLayout></main>
    </div>
  </div>
  <MoldDialog v-if="dialog" :visible="true" :title="dialogTitle" size="xl" form-actions focus-guard @cancel="dialog = ''">
    <div class="policy-body">
      <a-alert type="info" show-icon message="설계 예시 · 실제 적용 요청을 보내지 않습니다." />
      <template v-if="dialog === 'remove'">
        <a-alert type="warning" show-icon message="정책 등록을 해제합니다. 디렉터리·파일·실제 POSIX ACL을 보존합니다."
          description="참조 공유가 있으면 해제할 수 없습니다. 이 예시는 NFS·SMB 참조가 있어 차단됩니다." />
        <a-descriptions bordered :column="1" size="small"><a-descriptions-item label="대상">/export/team/docs</a-descriptions-item><a-descriptions-item label="차단 사유">DIRECTORY_POLICY_IN_USE</a-descriptions-item></a-descriptions>
      </template>
      <template v-else-if="dialog === 'clear'">
        <a-alert type="warning" show-icon message="실제 POSIX ACL의 선택 항목을 제거합니다."
          description="ACCESS·DEFAULT 범위를 구분합니다. 소유자·기본 그룹·mode와 외부 관리 항목은 유지하고, SMB가 요구하는 항목은 제거를 차단합니다." />
        <a-table :columns="clearColumns" :data-source="clearRows" :pagination="false" size="small" />
        <a-checkbox v-model:checked="ack" class="spaced">실제 ACL 제거와 이후 새 객체 상속에 미치는 영향을 확인했습니다.</a-checkbox>
      </template>
      <template v-else>
        <a-form layout="vertical">
          <a-row :gutter="16" class="spaced">
            <a-col :span="10"><a-form-item label="백킹 볼륨"><a-input value="sharedfs-DATA · 2 GiB · SPARSE" readonly /></a-form-item></a-col>
            <a-col :span="14"><a-form-item label="볼륨 내 상대 경로"><a-input value="export/team/docs" :readonly="dialog !== 'register'" /><div class="muted">기존 디렉터리의 FS UUID·mount ID·inode 검증</div></a-form-item></a-col>
          </a-row>
          <a-descriptions bordered :column="2" size="small">
            <a-descriptions-item label="소유자">root · UID 0</a-descriptions-item><a-descriptions-item label="그룹">team · GID 65001</a-descriptions-item>
            <a-descriptions-item label="현재 실제 mode">2770</a-descriptions-item><a-descriptions-item label="정책 리비전">12 · 일치</a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="dialog === 'register'" class="spaced" type="info" show-icon message="현재 실제 소유권과 ACL을 관측해 등록합니다. 권장값을 자동 적용하지 않습니다." />
          <template v-else>
            <div class="section-label">소유권과 기본 권한</div>
            <a-row :gutter="16">
              <a-col :span="8"><a-form-item label="소유자 UID"><a-input-number :value="0" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="그룹 GID"><a-input-number :value="65001" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="mode (8진수)"><a-input value="2770" /></a-form-item></a-col>
            </a-row>
            <a-checkbox :checked="true">새 하위 디렉터리에 그룹 상속 (setgid)</a-checkbox>
            <div class="section-label">POSIX ACL</div>
            <div class="toolbar"><a-button size="small" @click="notice = '합성 행 추가 예시입니다.'"><PlusOutlined />항목 추가</a-button><span class="muted">등록 이름과 해석된 숫자 ID를 함께 확인합니다.</span></div>
            <a-table :columns="aclColumns" :data-source="aclRows" row-key="id" :pagination="false" size="small" :scroll="{ x: 700 }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'scope'"><a-select v-model:value="record.scope" size="small" class="scope"><a-select-option value="ACCESS">ACCESS · 현재 접근</a-select-option><a-select-option value="DEFAULT">DEFAULT · 신규 객체</a-select-option><a-select-option value="BOTH">양쪽</a-select-option></a-select></template>
                <template v-if="column.key === 'principal'"><strong>{{ record.principal }}</strong><div class="muted">{{ record.resolved }}</div></template>
                <template v-if="column.key === 'rights'"><a-checkbox :checked="true">R</a-checkbox><a-checkbox :checked="record.write">W</a-checkbox><a-checkbox :checked="true">X</a-checkbox></template>
              </template>
            </a-table>
            <div class="muted">access mask rwx · default mask rwx · mode의 그룹 비트는 ACL mask와 연결됩니다.</div>
          </template>
          <div class="section-label">영향받는 공유와 접근 조건</div>
          <a-table :columns="refColumns" :data-source="refs" :pagination="false" size="small" />
          <a-alert class="spaced" type="info" show-icon message="선택한 디렉터리 1개에 적용 · 기존 하위 데이터 보존"
            description="DEFAULT ACL은 새 객체에 상속됩니다. NFS squash·RO/RW, SMB 인증·계정 ACL과 생성 mask가 함께 적용됩니다." />
          <template v-if="checked || dialog === 'blocked'">
            <div class="section-label">사전 점검 결과</div>
            <a-alert :type="dialog === 'blocked' ? 'error' : 'success'" show-icon
              :message="dialog === 'blocked' ? 'DIRECTORY_ACL_MASK_CONFLICT · 적용 차단' : 'READY · 디렉터리 1개, 기존 하위 항목 0개 변경'"
              :description="dialog === 'blocked' ? 'SMB 쓰기에 필요한 rwx가 제안한 mask r-x로 제한됩니다. mask 변경이 필요합니다.' : 'FS UUID·mount ID·inode·정책 리비전·ACL 관측 지문을 적용 직전에 재검증합니다.'" />
            <a-checkbox v-if="dialog !== 'blocked'" v-model:checked="ack" class="spaced">현재 접근·신규 객체 상속 변경과 공유 영향을 확인했습니다.</a-checkbox>
          </template>
        </a-form>
      </template>
      <a-alert v-if="notice" class="spaced" type="info" :message="notice" />
      <MoldDialogActions>
        <a-button @click="dialog = ''">취소</a-button>
        <a-button type="primary" :disabled="dialog === 'remove' || dialog === 'blocked' || ((checked || dialog === 'clear') && !ack)" @click="preview">{{ checked || dialog === 'clear' ? '확인' : '사전 점검' }}</a-button>
      </MoldDialogActions>
    </div>
  </MoldDialog>
</div>
</a-config-provider>
</template>
<script>
import koKR from 'ant-design-vue/es/locale/ko_KR'
import Breadcrumb from '@/components/widgets/Breadcrumb.vue'
import ResourceLayout from '@/layouts/ResourceLayout.vue'
import MoldDialog from '@/components/view/MoldDialog.vue'
import MoldDialogActions from '@/components/view/MoldDialogActions.vue'
import { ReloadOutlined, PlusOutlined, EditOutlined, DownOutlined, FileTextOutlined } from '@ant-design/icons-vue'
const query = new URLSearchParams(location.search)
export default {
  components: { Breadcrumb, ResourceLayout, MoldDialog, MoldDialogActions, ReloadOutlined, PlusOutlined, EditOutlined, DownOutlined, FileTextOutlined },
  data () {
    return {
      locale: koKR, dark: query.get('theme') === 'dark', tab: 'directory', dialog: query.get('dialog') || '',
      checked: query.get('preview') === '1', ack: false, notice: '',
      columns: [
        { title: '볼륨 내 경로', key: 'path', width: 190 }, { title: 'UID:GID / mode', dataIndex: 'posix', width: 140 },
        { title: 'ACL 접근 / 기본', dataIndex: 'acl', width: 100 }, { title: '참조하는 공유', key: 'refs', width: 150 },
        { title: '상태', key: 'state', width: 80 }, { title: '작업', key: 'actions', width: 180 }
      ],
      rows: [
        { path: '/export/team/docs', posix: '0:65001 / 2770', acl: '2 / 2' },
        { path: '/export/team/archive', posix: '0:65001 / 2750', acl: '1 / 1' }
      ],
      aclColumns: [
        { title: '적용 범위', key: 'scope', width: 190 }, { title: '주체와 숫자 ID', key: 'principal', width: 220 },
        { title: '설정 권한', key: 'rights', width: 170 }, { title: 'mask 적용 후', dataIndex: 'effective', width: 110 }
      ],
      aclRows: [
        { id: 'local', scope: 'ACCESS', principal: '로컬 사용자 · team-user', resolved: 'UID 65002 · 해석 완료', write: true, effective: 'rwx' },
        { id: 'ad', scope: 'BOTH', principal: 'AD 그룹 · ABLESTACK\\team', resolved: 'GID 100001 · 합성 예시', write: false, effective: 'r-x' }
      ],
      refColumns: [{ title: '공유', dataIndex: 'name', width: 130 }, { title: '관계', dataIndex: 'relation', width: 100 }, { title: '별도 접근 조건', dataIndex: 'condition' }],
      refs: [{ name: 'NFS · team', relation: '부모 경로', condition: 'CIDR · RW · root_squash' }, { name: 'SMB · team', relation: '부모 경로', condition: '로컬/AD 인증 · 계정 ACL' }],
      clearColumns: [{ title: '범위', dataIndex: 'scope' }, { title: '주체', dataIndex: 'principal' }, { title: '권한', dataIndex: 'rights' }],
      clearRows: [{ scope: 'DEFAULT', principal: 'group · 65002', rights: 'r-x' }],
      details: [['이름', 'sharedfs-posix-design'], ['상태', 'Ready'], ['파일 시스템', 'XFS'], ['프로비저닝', 'SPARSE']]
    }
  },
  computed: {
    dialogTitle () { return { edit: '디렉터리 POSIX 정책 편집', blocked: '디렉터리 POSIX 정책 편집', register: '기존 디렉터리 등록', remove: '정책 등록 해제', clear: 'POSIX ACL 항목 제거' }[this.dialog] }
  },
  watch: { dark: { immediate: true, handler (value) { document.body.classList.toggle('dark-mode', value) } } },
  methods: {
    open (dialog) { this.dialog = dialog; this.ack = false; this.checked = false; this.notice = '' },
    preview () { if (!this.checked && this.dialog !== 'clear') this.checked = true; else this.notice = '목업 확인 완료 · 실제 API 요청 없음' }
  }
}
</script>
<style>
.design-root { min-height: 100vh; color: var(--ui-text-primary); background: var(--ui-bg-page); }
.design-note { display: flex; gap: 8px; align-items: center; padding: 10px 16px; font-size: 12px; background: var(--ui-bg-elevated); border-bottom: 1px solid var(--ui-border); }
.design-note > span { flex: 1; color: var(--ui-text-secondary); }
.shell { display: flex; min-height: calc(100vh - 54px); }
aside { width: 200px; flex-shrink: 0; padding: 20px 16px; background: var(--ui-bg-elevated); border-right: 1px solid var(--ui-border); }
aside > b { font-size: 26px; } aside p { margin: 26px 8px; }
.selected { padding: 12px; color: var(--ui-link); background: var(--ui-bg-selected); border-radius: 4px; }
.workspace { flex: 1; min-width: 0; }
header { height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; background: var(--ui-bg-elevated); border-bottom: 1px solid var(--ui-border); }
.breadcrumb-card { border-radius: 0; } .breadcrumb-card > .ant-card-body { padding: 16px 24px; }
.right { text-align: right; } main { padding: 16px 24px; }
.resource-info h3 { margin: 16px 0; color: var(--ui-text-primary); overflow-wrap: anywhere; }
.resource-icon { font-size: 36px; color: var(--ui-link); } dt { font-weight: 600; margin: 16px 0 4px; } dd { margin: 0; }
.tab-card > .ant-card-body { padding: 16px; } .tab-card .ant-tabs-nav { min-width: 112px; }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tab-card .ant-alert { margin-bottom: 16px; } .section-label { margin: 20px 0 12px; font-weight: 600; }
.muted { color: var(--ui-text-secondary); font-size: 12px; margin-top: 4px; } .spaced { margin-top: 16px; }
.policy-body { color: var(--ui-text-primary); } .policy-body .ant-input-number { width: 100%; } .policy-body .ant-form-item { margin-bottom: 16px; }
.design-root .ant-btn-primary, .mold-dialog .ant-btn-primary { background: #096dd9; border-color: #096dd9; color: #fff; }
.scope { width: 170px; } .detail { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.detail strong { color: var(--ui-text-secondary); }
@media (max-width: 1000px) { aside { display: none; } main { padding: 16px; } .design-note > span { display: none; } }
</style>
