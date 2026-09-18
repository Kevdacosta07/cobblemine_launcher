'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const core=require('@xmcl/core'),installer=require('@xmcl/installer');
const {json,download,safePath,noSymlinks,atomicJson,readJson}=require('./utils.cjs');
const {installPack,inspectPack}=require('./packs.cjs');
const exec=promisify(execFile);
const {downloadAgent}=require('./network.cjs');
const {startBridge}=require('./join-bridge.cjs');
class Game{
 constructor(root,emit){this.root=root;this.emit=emit;this.resource=path.join(root,'minecraft');this.child=null;}
 progress(label,done=0,total=0){this.emit({type:'progress',label,done,total});}
 async task(factory,label,signal){let error;for(let attempt=0;attempt<3;attempt++){signal.throwIfAborted();const task=factory();this.progress(label+(attempt?' · reprise '+attempt:''));let last=0;const cancel=()=>task.cancel().catch(()=>{});signal.addEventListener('abort',cancel,{once:true});try{return await task.startAndWait({onUpdate:()=>{if(Date.now()-last>150){last=Date.now();this.progress(label,Math.max(0,task.progress||0),Math.max(0,task.total||0));}}});}catch(e){error=e;}finally{signal.removeEventListener('abort',cancel);signal.throwIfAborted();}}throw error;}
 async ensureJava(signal){const root=path.join(this.root,'runtime','java21');const executable=path.join(root,process.platform==='darwin'?'jre.bundle/Contents/Home/bin/java':process.platform==='win32'?'bin/java.exe':'bin/java');
 try{await fs.access(path.join(root,'.complete'));const {stderr,stdout}=await exec(executable,['-version'],{windowsHide:true,timeout:15000});if(/version "21[.\"]/.test(stderr+stdout))return executable;}catch{}
 this.progress('Installation de Java 21');const all=await json(installer.DEFAULT_RUNTIME_ALL_URL,{signal});const platform=process.platform==='win32'?(process.arch==='arm64'?'windows-arm64':'windows-x64'):process.platform==='darwin'?(process.arch==='arm64'?'mac-os-arm64':'mac-os'):'linux';if(process.platform==='linux'&&process.arch!=='x64')throw Error('Cette version Linux nécessite un processeur x64.');
 const target=all[platform]?.['java-runtime-delta']?.find(t=>t.version.name.startsWith('21'));if(!target)throw Error('Java 21 indisponible pour cette plateforme.');
 const manifestPath=path.join(this.root,'runtime','java21-manifest.json');await download(target.manifest.url,manifestPath,{hash:target.manifest.sha1,algorithm:'sha1',size:target.manifest.size,signal});const manifest=await readJson(manifestPath);const entries=Object.entries(manifest.files);let done=0;
 await fs.mkdir(root,{recursive:true});for(const [name,entry] of entries){signal.throwIfAborted();const file=safePath(root,name);if(entry.type==='directory'){await fs.mkdir(file,{recursive:true});continue;}if(entry.type==='link')continue;await noSymlinks(root,file);const d=entry.downloads.raw;await download(d.url,file,{hash:d.sha1,algorithm:'sha1',size:d.size,signal,onProgress:(n,t)=>this.progress('Java 21 : '+path.basename(name),done+(t?n/t:0),entries.length)});if(entry.executable&&process.platform!=='win32')await fs.chmod(file,0o755);done++;}
 for(const [name,entry] of entries.filter(([,e])=>e.type==='link')){const dest=safePath(root,name);const targetPath=path.resolve(path.dirname(dest),entry.target);if(!targetPath.startsWith(root+path.sep))throw Error('Lien Java invalide.');await fs.mkdir(path.dirname(dest),{recursive:true});try{await fs.symlink(entry.target,dest);}catch(e){if(e.code!=='EEXIST')throw e;}}
 const {stderr,stdout}=await exec(executable,['-version'],{windowsHide:true,timeout:15000});if(!/version "21[.\"]/.test(stderr+stdout))throw Error('Java 21 ne démarre pas.');await fs.writeFile(path.join(root,'.complete'),target.version.name);return executable;}
 async install(selection,signal){const java=await this.ensureJava(signal);const builtin=require('../builtin-pack.json');let plan,id,archive;
 if(selection?.archive){archive=selection.archive;const inspected=await inspectPack(archive);plan=inspected.plan;id=inspected.id;}else{plan=builtin;id='base-'+builtin.revision;}
 if(plan.loader!=='fabric')throw Error('La connexion Cobblemine nécessite un pack Fabric 1.21.1.');
 const instance=path.join(this.root,'instances',id);await fs.mkdir(instance,{recursive:true});await fs.mkdir(this.resource,{recursive:true});
 this.progress('Préparation de Minecraft 1.21.1');const list=await json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',{signal});const version=list.versions.find(v=>v.id==='1.21.1');if(!version)throw Error('Minecraft 1.21.1 introuvable.');
 await this.task(()=>installer.installTask(version,this.resource,{agent:downloadAgent,assetsDownloadConcurrency:4,librariesDownloadConcurrency:4}), 'Téléchargement de Minecraft 1.21.1',signal);
 let versionId;
 if(plan.loader==='fabric'){this.progress('Installation de Fabric '+plan.loaderVersion);const artifact=await json('https://meta.fabricmc.net/v2/versions/loader/1.21.1/'+encodeURIComponent(plan.loaderVersion),{signal});versionId=await installer.installFabric(artifact,this.resource);}
 else{versionId=await this.task(()=>installer.installNeoForgedTask('neoforge',plan.loaderVersion,this.resource,{java,agent:downloadAgent}),'Installation de NeoForge',signal);}
 signal.throwIfAborted();const resolved=await core.Version.parse(this.resource,versionId);await this.task(()=>installer.installDependenciesTask(resolved,{agent:downloadAgent,assetsDownloadConcurrency:4,librariesDownloadConcurrency:4}),'Vérification des bibliothèques',signal);
 await installPack(plan,instance,{archive,signal,progress:(...args)=>this.progress(...args)});
 const result={instance,java,versionId,packName:plan.name,packId:id,installedAt:new Date().toISOString()};await atomicJson(path.join(this.root,'installed.json'),result);this.progress('Installation terminée',1,1);return result;}
 async launch(installed,settings,session,log,auth){if(this.child)throw Error('Minecraft est déjà ouvert.');const [width,height]=settings.resolution.split('x').map(Number);
 await fs.mkdir(path.join(installed.instance,'mods'),{recursive:true});
 await fs.copyFile(path.join(__dirname,'../assets/cobblemine-auth.jar'),path.join(installed.instance,'mods/cobblemine-auth.jar'));
 const bridge=await startBridge(auth,require('../launcher-config.json').authServers);
 let child;try{child=await core.launch({gamePath:installed.instance,resourcePath:this.resource,javaPath:installed.java,version:installed.versionId,accessToken:session.accessToken,userType:session.offline?'legacy':'msa',gameProfile:session.profile,features:{cobblemine_auth:{clientid:session.clientId,auth_xuid:session.xuid||'0'}},launcherName:'Cobblemine',versionType:'Cobblemine',minMemory:1024,maxMemory:settings.ram*1024,resolution:{width,height,fullscreen:settings.fullscreen},quickPlayMultiplayer:settings.autoJoin&&settings.serverAddress?settings.serverAddress:undefined,extraExecOption:{windowsHide:true,env:{...process.env,...bridge.env}},extraJVMArgs:['-Dfile.encoding=UTF-8']});}catch(error){bridge.close();throw error;}
 this.child=child;child.stdout?.on('data',b=>log(b.toString()));child.stderr?.on('data',b=>log(b.toString()));child.once('error',e=>{bridge.close();log('Erreur processus : '+e.message);this.child=null;this.emit({type:'game-exit',code:-1});});child.once('exit',code=>{bridge.close();this.child=null;this.emit({type:'game-exit',code});});return child.pid;}
}
module.exports={Game};

