const fs=require('fs');const ui='/root/work/ablestack-cloud/ui',out=__dirname+'/mockup';fs.mkdirSync(out,{recursive:true});
const copy=(p,n)=>fs.copyFileSync(ui+'/node_modules/'+p,out+'/'+n);
copy('vue/dist/vue.global.prod.js','vue.js');copy('dayjs/dayjs.min.js','dayjs.js');
const plugins=['advancedFormat','customParseFormat','localeData','quarterOfYear','weekOfYear','weekYear','weekday'];
plugins.forEach(n=>copy('dayjs/plugin/'+n+'.js',n+'.js'));
copy('ant-design-vue/dist/antd.min.js','antd.js');copy('ant-design-vue/dist/antd.min.css','antd-light.css');copy('ant-design-vue/dist/antd.dark.min.css','antd-dark.css');
const {parse}=require(ui+'/node_modules/@vue/compiler-sfc');const less=require(ui+'/node_modules/less');
let code='';
for(const name of ['MoldDialog','MoldDialogActions']){
 const d=parse(fs.readFileSync(ui+'/src/components/view/'+name+'.vue','utf8')).descriptor;
 code+='const '+name+'=(()=>{'+d.script.content.replace(/import \{([^}]+)\} from 'vue'/,(_,names)=>'const {'+names+'}=Vue').replace('export default','const Component=')+'\nComponent.template='+JSON.stringify(d.template.content)+'; return Component;})();\n';
}
fs.writeFileSync(out+'/mold-components.js',code);
less.render(fs.readFileSync(ui+'/src/style/components/view/mold-dialog.less','utf8')).then(v=>fs.writeFileSync(out+'/mold-dialog.css',v.css));
console.log(out);
