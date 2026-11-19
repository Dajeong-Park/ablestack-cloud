/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/
// Documentation-only, in-memory prototype. No network or persistent mutations.
(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  // Ubuntu icon: Font Awesome Free Brands, CC BY 4.0; https://fontawesome.com/license/free
  const kisoIcon = "<svg class=\"kubernetes-icon\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\" x=\"0px\" y=\"0px\" width=\"100\" height=\"100\" viewBox=\"0 0 50 50\"><path d=\"M 25 2.2773438 C 24.477218 2.2775288 23.954975 2.3938208 23.472656 2.6269531 L 8.0117188 10.091797 C 7.0499738 10.555895 6.3506462 11.43495 6.1132812 12.476562 L 2.2929688 29.259766 C 2.0568878 30.29908 2.3056798 31.391792 2.96875 32.226562 L 13.671875 45.683594 C 14.338066 46.521569 15.352133 47.009766 16.421875 47.009766 L 33.578125 47.009766 C 34.647867 47.009766 35.661934 46.521569 36.328125 45.683594 L 47.03125 32.228516 L 47.03125 32.226562 C 47.694185 31.39248 47.944721 30.300911 47.708984 29.261719 A 1.0001 1.0001 0 0 0 47.708984 29.259766 L 43.886719 12.476562 A 1.0001 1.0001 0 0 0 43.886719 12.474609 C 43.649412 11.434647 42.950464 10.556829 41.988281 10.091797 L 26.529297 2.6269531 A 1.0001 1.0001 0 0 0 26.527344 2.625 C 26.044986 2.3928828 25.522782 2.2771587 25 2.2773438 z M 25 4.2773438 C 25.224653 4.2774147 25.44878 4.3272999 25.658203 4.4277344 L 41.119141 11.892578 C 41.534958 12.093546 41.834807 12.469885 41.9375 12.919922 L 45.757812 29.703125 C 45.859943 30.153346 45.753012 30.622684 45.466797 30.982422 L 34.763672 44.439453 C 34.475863 44.801477 34.040383 45.009766 33.578125 45.009766 L 16.421875 45.009766 C 15.959617 45.009766 15.526091 44.801477 15.238281 44.439453 L 4.5351562 30.982422 C 4.2482266 30.621193 4.1402683 30.151811 4.2421875 29.703125 L 8.0644531 12.921875 C 8.1670882 12.471488 8.4666043 12.094433 8.8808594 11.894531 A 1.0001 1.0001 0 0 0 8.8808594 11.892578 L 24.341797 4.4277344 C 24.550169 4.3270161 24.775347 4.2772728 25 4.2773438 z M 24.992188 8.484375 C 24.851094 8.4846875 24.707812 8.5128125 24.570312 8.5703125 C 24.020312 8.8103125 23.76 9.45 24 10 C 24.23 10.54 24.309141 11.079141 24.369141 11.619141 C 24.389141 11.899141 24.400625 12.169453 24.390625 12.439453 C 24.420625 12.709453 24.280078 12.98 24.080078 13.25 C 23.870078 13.52 23.850312 13.790547 23.820312 14.060547 C 21.076091 14.329904 18.605618 15.53251 16.716797 17.339844 L 16.699219 17.330078 C 16.469219 17.180078 16.250391 17.029531 15.900391 17.019531 C 15.570391 16.999531 15.270078 16.940234 15.080078 16.740234 C 14.870078 16.580234 14.660703 16.400938 14.470703 16.210938 C 14.080703 15.830937 13.709453 15.420391 13.439453 14.900391 C 13.309453 14.650391 13.069297 14.449375 12.779297 14.359375 C 12.199297 14.199375 11.599688 14.529375 11.429688 15.109375 C 11.259688 15.679375 11.599687 16.289219 12.179688 16.449219 C 12.739688 16.619219 13.209922 16.899219 13.669922 17.199219 C 13.889922 17.349219 14.100547 17.509453 14.310547 17.689453 C 14.540547 17.839453 14.66 18.119453 14.75 18.439453 C 14.815992 18.759984 14.999921 18.945416 15.179688 19.125 C 13.81088 21.074269 13 23.443157 13 26 C 13 26.422964 13.023472 26.840139 13.066406 27.251953 C 12.842073 27.330478 12.62004 27.415663 12.429688 27.640625 C 12.209687 27.890625 11.969219 28.089375 11.699219 28.109375 C 11.439219 28.179375 11.170391 28.229766 10.900391 28.259766 C 10.360391 28.329766 9.8102344 28.37 9.2402344 28.25 C 8.9602344 28.2 8.6503906 28.259453 8.4003906 28.439453 C 7.9103906 28.779453 7.800625 29.459219 8.140625 29.949219 C 8.490625 30.439219 9.1701562 30.560937 9.6601562 30.210938 C 10.140156 29.870938 10.649922 29.679766 11.169922 29.509766 C 11.429922 29.429766 11.690938 29.360547 11.960938 29.310547 C 12.220937 29.220547 12.510313 29.299688 12.820312 29.429688 C 13.077895 29.562633 13.305954 29.552045 13.53125 29.529297 C 14.411477 32.383087 16.336155 34.773926 18.849609 36.283203 C 18.763733 36.523485 18.683169 36.773884 18.759766 37.089844 C 18.819766 37.419844 18.829453 37.730938 18.689453 37.960938 C 18.579453 38.210938 18.460078 38.449453 18.330078 38.689453 C 18.050078 39.149453 17.750547 39.609766 17.310547 40.009766 C 17.100547 40.199766 16.959219 40.469297 16.949219 40.779297 C 16.929219 41.379297 17.4 41.880391 18 41.900391 C 18.6 41.920391 19.110859 41.449609 19.130859 40.849609 C 19.140859 40.259609 19.300469 39.740703 19.480469 39.220703 C 19.570469 38.970703 19.680781 38.720469 19.800781 38.480469 C 19.890781 38.220469 20.129922 38.029141 20.419922 37.869141 C 20.708796 37.720044 20.838739 37.509224 20.96875 37.287109 C 22.230991 37.739556 23.5843 38 25 38 C 26.439867 38 27.815298 37.730979 29.095703 37.263672 C 29.231135 37.494815 29.370326 37.714564 29.660156 37.869141 C 29.950156 38.039141 30.189297 38.220469 30.279297 38.480469 C 30.399297 38.730469 30.499844 38.980469 30.589844 39.230469 C 30.769844 39.750469 30.919453 40.269375 30.939453 40.859375 C 30.939453 41.149375 31.059062 41.430625 31.289062 41.640625 C 31.739062 42.040625 32.420078 42.010312 32.830078 41.570312 C 33.230078 41.120312 33.199766 40.439297 32.759766 40.029297 C 32.319766 39.639297 32.02 39.169219 31.75 38.699219 C 31.62 38.469219 31.500625 38.220469 31.390625 37.980469 C 31.250625 37.740469 31.260078 37.439375 31.330078 37.109375 C 31.410078 36.769375 31.320234 36.519766 31.240234 36.259766 L 31.232422 36.234375 C 33.725863 34.710051 35.625253 32.311926 36.486328 29.458984 L 36.519531 29.460938 C 36.799531 29.480937 37.069141 29.509844 37.369141 29.339844 C 37.669141 29.199844 37.970469 29.119219 38.230469 29.199219 C 38.490469 29.239219 38.759531 29.299141 39.019531 29.369141 C 39.539531 29.519141 40.060781 29.699297 40.550781 30.029297 C 40.790781 30.179297 41.090625 30.249687 41.390625 30.179688 C 41.980625 30.049688 42.350703 29.470625 42.220703 28.890625 C 42.090703 28.300625 41.509922 27.930547 40.919922 28.060547 C 40.339922 28.190547 39.8 28.169141 39.25 28.119141 C 38.98 28.089141 38.719219 28.050234 38.449219 27.990234 C 38.179219 27.970234 37.940938 27.790781 37.710938 27.550781 C 37.480938 27.280781 37.220937 27.210859 36.960938 27.130859 L 36.943359 27.125 C 36.978072 26.754075 37 26.379828 37 26 C 37 23.520714 36.243083 21.213679 34.949219 19.298828 C 35.13888 19.099219 35.330515 18.909707 35.400391 18.570312 C 35.490391 18.250312 35.609844 17.970312 35.839844 17.820312 C 36.039844 17.640313 36.260469 17.480312 36.480469 17.320312 C 36.930469 17.020312 37.400937 16.730312 37.960938 16.570312 C 38.240938 16.490313 38.479141 16.299531 38.619141 16.019531 C 38.899141 15.489531 38.690391 14.830547 38.150391 14.560547 C 37.620391 14.280547 36.959453 14.489297 36.689453 15.029297 C 36.419453 15.549297 36.049922 15.959844 35.669922 16.339844 C 35.469922 16.529844 35.270547 16.710859 35.060547 16.880859 C 34.870547 17.080859 34.570234 17.140156 34.240234 17.160156 C 33.890234 17.170156 33.669453 17.330469 33.439453 17.480469 C 31.532566 15.591338 28.997515 14.337129 26.179688 14.060547 C 26.149687 13.790547 26.129922 13.52 25.919922 13.25 C 25.719922 12.98 25.579375 12.709453 25.609375 12.439453 C 25.599375 12.169453 25.610859 11.899141 25.630859 11.619141 C 25.690859 11.079141 25.77 10.54 26 10 C 26.11 9.74 26.12 9.430625 26 9.140625 C 25.82 8.728125 25.415469 8.4834375 24.992188 8.484375 z M 23.558594 16.115234 L 23.509766 16.5 C 23.369766 17.58 23.269922 18.67 23.169922 19.75 C 23.109922 20.32 23.059531 20.900703 23.019531 21.470703 C 22.529531 21.120703 22.039531 20.749922 21.519531 20.419922 C 20.619531 19.809922 19.719062 19.199141 18.789062 18.619141 L 18.474609 18.423828 C 19.881084 17.211935 21.629049 16.393039 23.558594 16.115234 z M 26.441406 16.115234 C 28.449951 16.404413 30.258788 17.284 31.693359 18.578125 L 31.359375 18.789062 C 30.439375 19.379062 29.550391 19.989609 28.650391 20.599609 C 28.290391 20.839609 27.939609 21.089844 27.599609 21.339844 C 27.329609 21.529844 26.959453 21.359297 26.939453 21.029297 C 26.909453 20.599297 26.870078 20.18 26.830078 19.75 C 26.730078 18.67 26.630234 17.58 26.490234 16.5 L 26.441406 16.115234 z M 16.582031 20.607422 L 16.900391 20.939453 C 17.660391 21.729453 18.430937 22.489766 19.210938 23.259766 C 19.540937 23.589766 19.870937 23.900937 20.210938 24.210938 C 20.450937 24.430937 20.360781 24.820156 20.050781 24.910156 C 19.560781 25.060156 19.070078 25.199375 18.580078 25.359375 C 17.550078 25.699375 16.510469 26.020625 15.480469 26.390625 L 15.027344 26.548828 C 15.017439 26.365855 15 26.185504 15 26 C 15 24.009707 15.585092 22.163224 16.582031 20.607422 z M 33.537109 20.804688 C 34.458955 22.319179 35 24.0924 35 26 C 35 26.167032 34.98265 26.32915 34.974609 26.494141 L 34.619141 26.380859 C 33.579141 26.040859 32.540234 25.749219 31.490234 25.449219 C 30.810234 25.249219 30.129219 25.070391 29.449219 24.900391 C 29.959219 24.410391 30.490469 23.929687 30.980469 23.429688 C 31.750469 22.659688 32.519531 21.889844 33.269531 21.089844 L 33.537109 20.804688 z M 24.380859 24 L 25.599609 24 C 25.789609 24 25.970313 24.090469 26.070312 24.230469 L 26.849609 25.210938 C 26.959609 25.340937 27.000703 25.529219 26.970703 25.699219 L 26.689453 26.910156 C 26.659453 27.100156 26.529141 27.249844 26.369141 27.339844 L 25.25 27.859375 C 25.09 27.949375 24.890469 27.949375 24.730469 27.859375 L 23.609375 27.339844 C 23.449375 27.249844 23.309062 27.100156 23.289062 26.910156 L 23.009766 25.699219 C 22.979766 25.529219 23.020859 25.340938 23.130859 25.210938 L 23.910156 24.230469 C 24.010156 24.090469 24.190859 24 24.380859 24 z M 20.769531 28.769531 C 21.079531 28.719531 21.330938 29.030312 21.210938 29.320312 C 21.020937 29.820312 20.839922 30.310547 20.669922 30.810547 C 20.299922 31.840547 19.939609 32.860391 19.599609 33.900391 L 19.462891 34.330078 C 17.683095 33.146647 16.31612 31.405254 15.587891 29.355469 L 16.119141 29.310547 C 17.209141 29.210547 18.279141 29.079219 19.369141 28.949219 C 19.839141 28.899219 20.299531 28.829531 20.769531 28.769531 z M 29.410156 28.910156 C 29.880156 28.960156 30.340547 29.010781 30.810547 29.050781 C 31.900547 29.150781 32.980312 29.250312 34.070312 29.320312 L 34.417969 29.339844 C 33.702862 31.363494 32.36593 33.088437 30.623047 34.273438 L 30.509766 33.910156 C 30.179766 32.870156 29.820703 31.840312 29.470703 30.820312 C 29.310703 30.360312 29.150469 29.910938 28.980469 29.460938 C 28.870469 29.170938 29.110156 28.870156 29.410156 28.910156 z M 25.074219 30.882812 C 25.216719 30.882812 25.359453 30.954609 25.439453 31.099609 C 25.659453 31.519609 25.890859 31.929844 26.130859 32.339844 C 26.670859 33.279844 27.209063 34.230391 27.789062 35.150391 L 28.025391 35.533203 C 27.071252 35.83443 26.055471 36 25 36 C 23.976312 36 22.989581 35.844572 22.060547 35.560547 L 22.310547 35.160156 C 22.890547 34.240156 23.440234 33.299375 23.990234 32.359375 C 24.240234 31.949375 24.480937 31.529609 24.710938 31.099609 C 24.790937 30.954609 24.931719 30.882812 25.074219 30.882812 z\"></path></svg>"
  const ubuntuPath = 'M469.2 75A75.6 75.6 0 1 0 317.9 75a75.6 75.6 0 1 0 151.2 0zM154.2 240.7A75.6 75.6 0 1 0 3 240.7a75.6 75.6 0 1 0 151.2 0zM57 346C75.6 392.9 108 433 150 461.1s91.5 42.6 142 41.7c-14.7-18.6-22.9-41.5-23.2-65.2c-6.8-.9-13.3-2.1-19.5-3.4c-26.8-5.7-51.9-17.3-73.6-34s-39.3-38.1-51.7-62.5c-20.9 9.9-44.5 12.8-67.1 8.2zm395.1 89.8a75.6 75.6 0 1 0 -151.2 0 75.6 75.6 0 1 0 151.2 0zM444 351.6c18.5 14.8 31.6 35.2 37.2 58.2c33.3-41.3 52.6-92.2 54.8-145.2s-12.5-105.4-42.2-149.4c-8.6 21.5-24 39.6-43.8 51.6c15.4 28.6 22.9 60.8 21.9 93.2s-10.7 64-28 91.6zM101.1 135.4c12.4 2.7 24.3 7.5 35.1 14.3c16.6-24.2 38.9-44.1 64.8-58S255.8 70.4 285.2 70c.2-5.9 .9-11.9 2-17.7c3.6-16.7 11.1-32.3 21.8-45.5c-47.7-3.8-95.4 6-137.6 28.5S94.3 91.7 70.8 133.4c2.7-.2 5.3-.3 8-.3c7.5 0 15 .8 22.4 2.3z'
  const ubuntu = '<svg aria-label="Ubuntu" role="img" viewBox="0 0 576 512"><path d="' + ubuntuPath + '"/></svg>'
  const icon = row => row.os === 'Ubuntu' ? ubuntu : '<span aria-hidden="true">◈</span>'
  const rows = [
    {id:'sample-version-01',name:'1.36.5-Kubernetes-Binaries-ISO',version:'1.36.5',enabled:true,availability:'ready',arch:'x86_64',zone:'13-Zone',cpu:2,ram:2048,iso:'sample-iso-01',direct:false,comment:false},
    {id:'sample-version-02',name:'쿠버네티스-바이너리-ISO-긴이름-한줄표시와전체이름툴팁확인',version:'1.35.9',enabled:true,availability:'checksum',arch:'x86_64',zone:'13-Zone',cpu:2,ram:2048,iso:'sample-iso-02',direct:false,comment:false},
    {id:'sample-version-03',name:'Kubernetes-ARM64-1.35.8',version:'1.35.8',enabled:false,availability:'loading',arch:'aarch64',zone:'13-Zone',cpu:2,ram:2048,iso:'sample-iso-03',direct:false,comment:false},
    {id:'sample-version-04',name:'전역-쿠버네티스-바이너리-ISO',version:'1.34.2',enabled:true,availability:'ready',arch:'x86_64',zone:'모든 Zone',cpu:2,ram:2048,iso:'sample-iso-04',direct:true,comment:false}
  ]
  const templates = [
    {id:'sample-template-01',name:'Europa-SystemVM-4.23-ISO1667-20261115',os:'Ubuntu',osLabel:'Ubuntu 24.04 LTS',arch:'x86_64',type:'SYSTEM',size:'4.88 GiB',comment:false},
    {id:'sample-template-02',name:'우분투-긴이름-클라우드-이미지-한줄표시-및-코멘트-아이콘-병존-확인',os:'Ubuntu',osLabel:'Ubuntu 24.04 LTS',arch:'x86_64',type:'USER',size:'8.00 GiB',comment:true},
    {id:'sample-template-03',name:'Rocky9',os:'Linux',osLabel:'Rocky Linux 9',arch:'x86_64',type:'USER',size:'100.00 GiB',comment:false},
    {id:'sample-template-04',name:'Windows Server 2025 x86_64 Base Image',os:'Windows',osLabel:'Windows Server 2025 (64-bit)',arch:'x86_64',type:'USER',size:'100.00 GiB',comment:true}
  ]
  const state={mode:'kiso',view:'list',tab:'details',keyword:'',minimum:'',zone:'',arch:'',ascending:false,selected:rows[0],role:'admin',scenario:'ready',modal:null,trigger:null,mockFile:false}
  const capability = key => state.role==='admin' || (state.role==='localonly' && key==='local')
  const status = (text,kind='') => '<span class="status '+kind+'">'+escape(text)+'</span>'
  const availability = row => {
    const key=state.view==='detail' ? state.scenario : row.availability
    if(key==='checksum') return status('다운로드 실패','error')
    if(key==='loading')return status('전송 중 62%','warning')
    if(key==='lookup')return status('조회 실패','warning')
    if(key==='denied')return status('조회 권한 없음','muted')
    if(key==='unknown')return status('결과 확인 필요','warning')
    return status('사용 가능','success')
  }
  const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i]}return 0}
  const message=text=>{$('feedback').textContent=text}
  const fields = entries => '<dl class="fields">'+entries.map(([k,v])=>'<div><dt>'+escape(k)+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>'
  const copyValue=value=>'<div class="value-action"><span>'+escape(value)+'</span><button type="button" data-copy="'+escape(value)+'" aria-label="'+escape(value)+' 복사">▣</button></div>'
  const nameCell=(row,template=false)=>'<span class="name-cell"><span class="os-slot">'+(template?icon(row):kisoIcon)+'</span><a class="name-link" href="#'+escape(row.id)+'" data-open="'+escape(row.id)+'" title="'+escape(row.name)+'">'+escape(row.name)+'</a>'+(row.comment?'<a class="comment" href="#'+escape(row.id)+'" title="코멘트 보기" data-open="'+escape(row.id)+'">▤</a>':'')+'</span>'
  function render(){
    const template=state.mode==='template', detail=state.view==='detail'
    $('breadcrumb-list').textContent=template?'템플릿':'쿠버네티스 ISO'
    $('crumb-tail').textContent=detail?' / '+state.selected.name:''
    $('crumb-tail').title=detail?state.selected.name:''
    document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===state.mode))
    if(!detail){
      $('page-actions').innerHTML=(!template&&capability('url')?'<button class="primary round" data-modal="url">＋ 쿠버네티스 버전 추가</button>':'')+(!template&&capability('local')?'<button data-modal="local" title="로컬에서 쿠버네티스 버전 추가" aria-label="로컬에서 쿠버네티스 버전 추가">⇧</button>':'')+(!template?'<button data-modal="search" aria-label="고급 검색">⚲</button>':'')+'<div class="search"><input id="keyword" aria-label="검색" placeholder="검색" value="'+escape(state.keyword)+'"><button id="search" aria-label="검색 실행">⌕</button></div>'
      renderList(template)
    } else {
      $('page-actions').innerHTML=state.mode==='kiso'&&capability('state')?'<button data-modal="state">버전 관리</button><button data-modal="delete">삭제</button>':''
      renderDetail(template)
    }
  }
  function renderList(template){
    let list=(template?templates:rows).filter(r=>r.name.toLowerCase().includes(state.keyword.toLowerCase()))
    if(!template)list=list.filter(r=>(!state.minimum||compare(r.version,state.minimum)>=0)&&(!state.zone||r.zone===state.zone||r.zone==='모든 Zone')&&(!state.arch||r.arch===state.arch))
    if(state.ascending&&!template)list=list.slice().sort((a,b)=>compare(a.version,b.version))
    const columns=template?'<col><col style="width:130px"><col style="width:190px"><col style="width:120px"><col style="width:110px"><col style="width:110px"><col style="width:110px">':'<col><col style="width:110px"><col style="width:120px"><col style="width:150px"><col style="width:90px"><col style="width:110px"><col style="width:120px"><col style="width:130px">'
    const heads=template?['이름','상태','OS 유형','CPU 아키텍처','크기','계정','템플릿 유형']:['이름','버전 상태','시맨틱 버전','ISO 가용성','최소 CPU','메모리(MB)','CPU 아키텍처','Zone']
    $('screen').innerHTML='<div class="surface"><div class="table-wrap" tabindex="0" aria-label="목록 가로 스크롤"><table class="'+(template?'template-table':'list-table')+'"><colgroup>'+columns+'</colgroup><thead><tr>'+heads.map(h=>'<th>'+(h==='시맨틱 버전'?'<button id="sort-version" aria-label="시맨틱 버전 오름차순">'+h+' '+(state.ascending?'↑':'↕')+'</button>':h)+'</th>').join('')+'</tr></thead><tbody>'+list.map(r=>'<tr><td>'+nameCell(r,template)+'</td>'+(template?'<td>'+status('사용 가능','success')+'</td><td title="'+escape(r.osLabel)+'">'+escape(r.osLabel)+'</td><td>'+r.arch+'</td><td>'+r.size+'</td><td><a href="#account">admin</a></td><td><span class="tag">'+r.type+'</span></td>':'<td>'+status(r.enabled?'사용':'사용 안 함',r.enabled?'success':'muted')+'</td><td>'+r.version+'</td><td>'+availability(r)+'</td><td>'+r.cpu+'</td><td>'+r.ram+'</td><td>'+r.arch+'</td><td title="'+r.zone+'">'+(r.zone==='모든 Zone'?escape(r.zone):'<a href="#zone">'+escape(r.zone)+'</a>')+'</td>')+'</tr>').join('')+(list.length?'':'<tr><td colspan="'+heads.length+'" class="empty">데이터 없음</td></tr>')+'</tbody></table></div></div><div class="pagination"><span>전체 '+list.length+'개 항목 중 '+(list.length?'1-'+list.length:'0-0')+' 표시</span><div class="page-buttons"><button disabled aria-label="이전 페이지">‹</button><button class="selected" aria-current="page">1</button><button disabled aria-label="다음 페이지">›</button><select aria-label="페이지 크기"><option>20 / 쪽</option><option>50 / 쪽</option></select></div></div>'
  }
  function renderDetail(template){
    const r=state.selected, role=state.role
    const tabs=template?[['details','상세'],['zones','Zone'],['events','이벤트']]:[['details','상세'],['zones','Zone'],['events','이벤트']]
    const info='<aside class="surface info-card"><div class="os-slot">'+(template?icon(r):kisoIcon)+'</div><h1 class="info-title">'+escape(r.name)+'</h1><div class="tags"><span class="tag">'+r.arch+'</span>'+(template?'<span class="tag">KVM</span>':'<span class="tag">v'+r.version+'</span>')+'</div><dl><dt>'+(template?'상태':'버전 상태')+'</dt><dd>'+status(template?'사용 가능':(r.enabled?'사용':'사용 안 함'),'success')+'</dd>'+(!template?'<dt>ISO 가용성</dt><dd>'+availability(r)+'</dd>':'')+'<dt>아이디</dt><dd>'+copyValue(r.id)+'</dd>'+(!template?'<dt>연결된 ISO</dt><dd><a href="#linked-iso" data-read-iso>'+escape(r.name)+'-Kubernetes-Binaries-ISO</a></dd><dt>범위</dt><dd>'+escape(r.zone)+'</dd>':'<dt>OS 유형</dt><dd>'+escape(r.osLabel)+'</dd>')+'<dt>생성일</dt><dd>2026. 11. 16. 오전 9:00:00</dd></dl></aside>'
    $('screen').innerHTML='<div class="detail-grid">'+info+'<section class="surface tab-surface"><div class="tabs-layout"><nav class="tabs" role="tablist" aria-label="상세 탭">'+tabs.map(([key,title])=>'<button role="tab" id="tab-'+key+'" aria-selected="'+(state.tab===key)+'" aria-controls="tab-content" class="'+(state.tab===key?'active':'')+'" data-tab="'+key+'">'+title+'</button>').join('')+'</nav><div class="tab-content" id="tab-content" role="tabpanel" aria-labelledby="tab-'+state.tab+'">'+detailContent(r,template,role)+'</div></div></section></div>'
  }
  function detailContent(r,template,role){
    if(state.tab==='events')return '<div class="tab-toolbar"><button id="event-refresh">↻ 업데이트</button><input aria-label="이벤트 검색" placeholder="검색"></div><div class="table-wrap"><table class="zone-table"><thead><tr><th style="width:130px">종류</th><th style="width:90px">상태</th><th>설명</th></tr></thead><tbody><tr><td title="KUBERNETES.VERSION.ADD">버전 등록</td><td>완료</td><td title="로컬 업로드 버전 등록 완료">로컬 업로드 버전 등록 완료</td></tr><tr><td>버전 변경</td><td>완료</td><td>버전 사용 상태 변경</td></tr></tbody></table></div><div class="tab-pagination"><button disabled>‹</button><button>1</button><button disabled>›</button><select aria-label="이벤트 페이지 크기"><option>20 / 쪽</option></select></div>'
    if(state.tab==='zones'){
      if(state.scenario==='lookup')return '<div class="tab-toolbar"><button id="zone-refresh">↻ 업데이트</button></div><div class="alert" role="alert"><p>Zone 가용성 정보를 불러오지 못했습니다.</p><button id="retry-zone">다시 시도</button></div>'
      if(state.scenario==='denied')return '<div class="alert info" role="status">연결된 ISO의 Zone 정보를 조회할 권한이 없습니다.</div>'
      return '<div class="tab-toolbar"><button id="zone-refresh">↻ 업데이트</button><input id="zone-search" aria-label="Zone 이름 검색" placeholder="Zone 이름 검색"></div><div class="table-wrap"><table class="zone-table"><colgroup><col style="width:150px"><col style="width:140px"><col><col style="width:110px"></colgroup><thead><tr><th>Zone</th><th>ISO 가용성</th><th>상태 정보</th><th>작업</th></tr></thead><tbody><tr><td><a href="#zone">13-Zone</a></td><td>'+availability(r)+'</td><td title="'+(state.scenario==='checksum'?'체크섬이 일치하지 않습니다. SHA-256 값을 확인하십시오.':'')+'">'+(state.scenario==='checksum'?'체크섬 불일치 · SHA-256 확인':state.scenario==='loading'?'<span class="progress"><span></span></span>62%':'사용 가능')+'</td><td><button data-read-iso>ISO 보기</button></td></tr></tbody></table></div><div class="tab-pagination"><span>전체 1개 항목</span><button disabled>‹</button><button>1</button><button disabled>›</button><select aria-label="Zone 페이지 크기"><option>20 / 쪽</option></select></div>'
    }
    const pairs=[['이름',escape(r.name)],['아이디',copyValue(r.id)]]
    if(template)return fields([...pairs,['OS 유형',escape(r.osLabel)],['CPU 아키텍처',r.arch],['템플릿 유형',r.type],['이미지 형식','QCOW2']])
    pairs.push(['시맨틱 버전',r.version],['버전 상태',status(r.enabled?'사용':'사용 안 함',r.enabled?'success':'muted')],['범위',escape(r.zone)],['연결된 ISO','<a href="#linked-iso" data-read-iso>'+escape(r.iso)+'</a>'],['ISO 가용성',availability(r)],['CPU 아키텍처',r.arch],['최소 CPU 코어',String(r.cpu)],['최소 메모리(MB)',String(r.ram)],['HA 지원','지원'],['오토스케일링 지원','지원'],['직접 다운로드',r.direct?'사용':'사용 안 함'])
    if(role==='admin')pairs.push(['ISO URL',copyValue('https://images.example.invalid/kubernetes/'+r.version+'/binaries.iso')])
    return fields(pairs)
  }
  const context = r=>'<dl class="context"><dt>이름</dt><dd>'+escape(r.name)+'</dd><dt>버전</dt><dd>'+escape(r.version)+'</dd><dt>아이디</dt><dd>'+escape(r.id)+'</dd><dt>현재 상태</dt><dd>'+(r.enabled?'사용':'사용 안 함')+'</dd></dl>'
  const input=(key,label,value='',full=false,help='')=>'<label class="field '+(full?'full':'')+'"><span class="'+(['checksum'].includes(key)?'':'required')+'">'+label+'</span><input name="'+key+'" id="field-'+key+'" value="'+escape(value)+'"><small>'+help+'</small><span class="field-error" id="error-'+key+'" aria-live="polite"></span></label>'
  function openModal(kind,trigger){
    state.modal=kind;state.trigger=trigger;state.mockFile=false
    const r=state.selected
    $('modal-submit').className=kind==='delete'?'danger':'primary';$('modal-submit').disabled=false
    const titles={url:'쿠버네티스 버전 추가',local:'로컬에서 쿠버네티스 버전 추가',state:'쿠버네티스 버전 관리',delete:'쿠버네티스 버전 삭제',search:'고급 검색'}
    $('modal-title').textContent=titles[kind]
    $('modal-submit').textContent=kind==='delete'?'삭제':kind==='search'?'검색':kind==='state'?'저장':'등록'
    let html=''
    if(kind==='url'||kind==='local'){
      html='<div class="form-grid">'+input('semanticversion','시맨틱 버전','1.36.6')+input('name','이름','쿠버네티스-바이너리-ISO')+'<label class="field"><span class="required">Zone</span><select name="zone"><option>13-Zone</option>'+(kind==='url'?'<option>모든 Zone</option>':'')+'</select></label><label class="field"><span>CPU 아키텍처</span><select name="arch"><option value="x86_64">x86_64</option><option value="aarch64">ARM64 (aarch64)</option></select></label>'+input('mincpu','최소 CPU 코어','2')+input('minram','최소 메모리(MB)','2048')
      html+=kind==='url'?input('url','URL','https://images.example.invalid/kubernetes/binaries.iso',true):'<div class="field full"><span class="required">ISO 파일</span><div class="file-zone"><div id="file-label">파일을 선택하십시오.</div><button type="button" id="choose-sample">샘플 ISO 선택</button></div><span id="error-file" class="field-error" aria-live="polite"></span></div>'
      html+=input('checksum','체크섬','',true,'MD5는 32자리, SHA-256은 {SHA-256}과 64자리 16진수 값을 입력합니다.')
      if(kind==='url')html+='<label class="field full"><span>직접 다운로드</span><select name="directdownload"><option value="false">사용 안 함</option><option value="true">사용</option></select></label>'
      html+='</div>'
    } else if(kind==='state')html=context(r)+'<label class="field"><span>버전 상태</span><select name="state"><option value="Enabled" '+(r.enabled?'selected':'')+'>사용</option><option value="Disabled" '+(!r.enabled?'selected':'')+'>사용 안 함</option></select></label>'
    else if(kind==='delete'){
      html=context(r)+'<dl class="context"><dt>연결된 ISO</dt><dd>'+escape(r.iso)+'</dd></dl><div class="alert warning-box">이 버전과 연결된 Kubernetes 바이너리 ISO가 함께 삭제됩니다.</div>'
      if(state.scenario==='referenced'){html+='<div class="alert" role="alert">기존 클러스터 또는 미완료 업그레이드에서 참조하고 있어 삭제할 수 없습니다.</div>';$('modal-submit').disabled=true}
      if(state.scenario==='unknown'){html+='<div class="alert info" role="status">이전 삭제 요청의 결과를 확인해야 합니다. 현재 목록을 다시 확인하십시오.</div>';$('modal-submit').disabled=true}
    } else if(kind==='search'){
      html='<div class="form-grid"><label class="field full"><span>최소 버전 기준</span><select name="minimum-mode" id="minimum-mode"><option value="semantic">시맨틱 버전</option><option value="id">등록된 버전</option></select></label><label class="field full" id="minimum-text"><span>최소 시맨틱 버전</span><input name="minimum" value="'+escape(state.minimum)+'" placeholder="예: 1.36.0"></label><label class="field full" id="minimum-id" hidden><span>등록된 버전</span><select name="minimum-id"><option value="">선택 안 함</option>'+rows.map(x=>'<option value="'+x.version+'">'+x.version+'</option>').join('')+'</select></label><label class="field"><span>Zone</span><select name="zone"><option value="">모든 범위</option><option>13-Zone</option></select></label><label class="field"><span>CPU 아키텍처</span><select name="arch"><option value="">모든 아키텍처</option><option>x86_64</option><option>aarch64</option></select></label></div>'
    }
    $('modal-body').innerHTML=html;$('modal').showModal()
  }
  function closeModal(){const trigger=state.trigger,kind=state.modal;$('modal').close();state.modal=null;if(trigger?.isConnected)trigger.focus();requestAnimationFrame(()=>{document.querySelector('[data-modal="'+kind+'"]')?.focus()})}
  document.addEventListener('click',event=>{
    const el=event.target.closest('button,a');if(!el)return
    if(el.dataset.nav){state.mode=el.dataset.nav;state.view='list';state.keyword='';state.minimum='';state.tab='details';render();message('');return}
    if(el.id==='breadcrumb-list'){state.view='list';render();return}
    if(el.id==='search'){state.keyword=$('keyword').value;render();return}
    if(el.id==='sort-version'){state.ascending=!state.ascending;render();return}
    if(el.dataset.open){event.preventDefault();state.selected=(state.mode==='template'?templates:rows).find(r=>r.id===el.dataset.open);state.view='detail';state.tab='details';if(state.mode==='kiso'){state.scenario=state.selected.availability;$('scenario').value=state.scenario}render();return}
    if(el.dataset.tab){state.tab=el.dataset.tab;render();$('tab-'+state.tab)?.focus();return}
    if(el.dataset.modal){openModal(el.dataset.modal,el);return}
    if(el.id==='modal-close'||el.id==='modal-cancel'){closeModal();return}
    if(el.id==='choose-sample'){state.mockFile=true;$('file-label').textContent='kubernetes-binaries.iso · 샘플 파일';$('error-file').textContent='';return}
    if(el.id==='retry-zone'){state.scenario='ready';$('scenario').value='ready';render();message('가용성 정보를 다시 확인했습니다.');return}
    if(el.dataset.copy){message('복사 예시: '+el.dataset.copy);return}
    if(el.hasAttribute('data-read-iso')){event.preventDefault();message(state.scenario==='denied'?'연결된 ISO 조회 권한이 없습니다.':'연결된 ISO 상세로 이동합니다. (목업)');return}
    if(['refresh','zone-refresh','event-refresh'].includes(el.id)){message('현재 정보를 갱신했습니다. (목업)');return}
    if(el.id==='nav-toggle'){document.querySelector('.sidebar').hidden=!document.querySelector('.sidebar').hidden;document.querySelector('.shell').style.gridTemplateColumns=document.querySelector('.sidebar').hidden?'minmax(0,1fr)':''}
  })
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.id==='keyword'){event.preventDefault();state.keyword=event.target.value;render()}})
  $('modal').addEventListener('keydown',event=>{
    if(event.key!=='Tab')return
    const controls=[...$('modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0)
    const first=controls[0],last=controls[controls.length-1]
    if(!first)return
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  })
  $('modal').addEventListener('cancel',()=>{state.modal=null})
  $('modal-form').addEventListener('submit',event=>{
    event.preventDefault()
    const form=new FormData(event.currentTarget),kind=state.modal
    if(kind==='url'||kind==='local'){
      const errors={}
      if(!/^\d+\.\d+\.\d+$/.test(form.get('semanticversion'))||compare(form.get('semanticversion'),'1.11.0')<0)errors.semanticversion='1.11.0 이상의 시맨틱 버전을 입력하십시오.'
      if(!String(form.get('name')).trim())errors.name='이름을 입력하십시오.'
      if(!Number.isInteger(Number(form.get('mincpu')))||Number(form.get('mincpu'))<2)errors.mincpu='최소 2개 이상의 정수 CPU 코어를 입력하십시오.'
      if(!Number.isInteger(Number(form.get('minram')))||Number(form.get('minram'))<2048)errors.minram='최소 2048MB 이상의 정수를 입력하십시오.'
      const checksum=String(form.get('checksum')).trim()
      if(checksum&&!/^(?:[a-fA-F0-9]{32}|\{MD5\}[a-fA-F0-9]{32}|\{SHA-256\}[a-fA-F0-9]{64})$/.test(checksum))errors.checksum='체크섬 형식 또는 길이를 확인하십시오.'
      if(kind==='local'&&!state.mockFile)errors.file='ISO 파일 1개를 선택하십시오.'
      if(kind==='url'&&!/^https?:\/\/\S+$/.test(form.get('url')))errors.url='유효한 HTTP/HTTPS URL을 입력하십시오.'
      $('modal-body').querySelectorAll('.field-error').forEach(x=>x.textContent='')
      Object.entries(errors).forEach(([key,value])=>{$('error-'+key).textContent=value})
      if(Object.keys(errors).length){$('modal-body').querySelector('.field-error:not(:empty)').scrollIntoView({block:'nearest'});return}
      const newRow={id:'sample-version-'+(rows.length+1),name:String(form.get('name')),version:String(form.get('semanticversion')),enabled:true,availability:'loading',arch:String(form.get('arch')),zone:String(form.get('zone')),cpu:Number(form.get('mincpu')),ram:Number(form.get('minram')),iso:'sample-upload-'+(rows.length+1),direct:form.get('directdownload')==='true'}
      rows.push(newRow);state.view='list';state.keyword='';state.minimum='';closeModal();render();message('등록 요청을 접수했습니다. ISO 가용성을 확인하십시오. (목업)');return
    }
    if(kind==='search'){state.minimum=form.get('minimum-mode')==='id'?String(form.get('minimum-id')):String(form.get('minimum'));state.zone=String(form.get('zone'));state.arch=String(form.get('arch'));closeModal();render();return}
    if(kind==='state'){state.selected.enabled=form.get('state')==='Enabled';closeModal();render();message('버전 상태를 저장했습니다. (목업)');return}
    if(kind==='delete'){const index=rows.indexOf(state.selected);if(index>=0)rows.splice(index,1);closeModal();state.view='list';render();message('버전과 연결된 ISO 삭제를 완료했습니다. (목업)')}
  })
  document.addEventListener('change',event=>{
    if(event.target.id==='minimum-mode'){$('minimum-text').hidden=event.target.value==='id';$('minimum-id').hidden=event.target.value!=='id'}
    if(event.target.id==='theme'){document.documentElement.classList.toggle('dark-mode',event.target.value==='dark');$('brand-logo').src='../../../ui/public/assets/'+(event.target.value==='dark'?'white-logo-ablestack.png':'logo-ablestack.png')}
    if(event.target.id==='role'){state.role=event.target.value;render()}
    if(event.target.id==='scenario'){state.scenario=event.target.value;if(state.view==='list'){state.selected=rows[0];state.view='detail';state.tab='zones'}render()}
  })
  const preview = new URLSearchParams(location.search)
  if(preview.get('theme')==='light'){$('theme').value='light';document.documentElement.classList.remove('dark-mode');$('brand-logo').src='../../../ui/public/assets/logo-ablestack.png'}
  if(preview.get('mode')==='template')state.mode='template'
  if(['readonly','localonly'].includes(preview.get('role'))){state.role=preview.get('role');$('role').value=state.role}
  if(['detail','zones','events'].includes(preview.get('view'))){state.view='detail';state.tab=preview.get('view')==='detail'?'details':preview.get('view')}
  if(['ready','checksum','loading','lookup','denied','referenced','unknown'].includes(preview.get('scenario'))){state.scenario=preview.get('scenario');$('scenario').value=state.scenario}
  if(state.mode==='template')state.selected=templates[0]
  render()
  if(['url','local','state','delete','search'].includes(preview.get('modal'))){const kind=preview.get('modal');openModal(kind,document.querySelector('[data-modal="'+kind+'"]'));if(preview.get('fileError')==='1')$('modal-form').requestSubmit()}
})()
