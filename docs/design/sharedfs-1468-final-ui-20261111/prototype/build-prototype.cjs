const fs=require('fs'),path=require('path');const ui=path.resolve(__dirname,'../../../../ui'),out=__dirname+'/mockup';
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(__dirname+'/prototype.html',out+'/index.html');
fs.copyFileSync(__dirname+'/data.js',out+'/data.js');
const vendor = [
 ['vue/dist/vue.global.js','vue.js'], ['ant-design-vue/dist/antd.js','antd.js'],
 ['ant-design-vue/dist/antd.css','antd-light.css'], ['ant-design-vue/dist/antd.dark.css','antd-dark.css'],
 ['dayjs/dayjs.min.js','dayjs.js'],
 ...['advancedFormat','customParseFormat','localeData','quarterOfYear','weekday','weekOfYear','weekYear'].map(n=>['dayjs/plugin/'+n+'.js',n+'.js'])
];
for(const [source,dest] of vendor) fs.copyFileSync(ui+'/node_modules/'+source,out+'/'+dest);
const {parse}=require(ui+'/node_modules/@vue/compiler-sfc');let code='';
for(const name of ['MoldDialog','MoldDialogActions','ResourceLayout']){
 const file=name==='ResourceLayout'?ui+'/src/layouts/ResourceLayout.vue':ui+'/src/components/view/'+name+'.vue';
 const d=parse(fs.readFileSync(file,'utf8')).descriptor;
 let script=d.script.content.replace(/import \{([^}]+)\} from 'vue'/,(_,n)=>'const {'+n+'}=Vue')
  .replace("import { mixinDevice } from '@/utils/mixin.js'","const mixinDevice={computed:{device(){return innerWidth>=1200?'desktop':'tablet'}}}")
  .replace('export default','const Component=');
 code+='const '+name+'=(()=>{'+script+'\nComponent.template='+JSON.stringify(d.template.content)+';return Component;})();\n';
}
fs.writeFileSync(out+'/mold-components.js',code);
const less=require(ui+'/node_modules/less');
less.render(fs.readFileSync(ui+'/src/style/components/view/mold-dialog.less','utf8')).then(x=>fs.writeFileSync(out+'/mold-dialog.css',x.css));
const names=['ReloadOutlined','PlusOutlined','FullscreenOutlined','FullscreenExitOutlined','PoweroffOutlined','EditOutlined','DeleteOutlined','DownOutlined','CopyOutlined'];
fs.writeFileSync(__dirname+'/icons-entry.js',names.map(n=>"export {default as "+n+"} from '@ant-design/icons-vue/es/icons/"+n+"';").join('\n'));
const webpack=require(ui+'/node_modules/webpack');
webpack({mode:'production',entry:__dirname+'/icons-entry.js',output:{path:out,filename:'icons.js',library:'MoldIcons',libraryTarget:'window'},externals:{vue:'Vue'},resolve:{modules:[ui+'/node_modules','node_modules']}},(error,stats)=>{if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1}else console.log(JSON.stringify({icons:names,bytes:fs.statSync(out+'/icons.js').size}))});
