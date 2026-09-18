'use strict';
// Run with Electron, not Node: global fetch must initialize Electron's own dispatcher first.
const {app}=require('electron'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.COBBLEMINE_CHECK_APP||path.resolve(__dirname,'..');
const output=process.env.COBBLEMINE_CHECK_OUTPUT;
if(!output)throw Error('COBBLEMINE_CHECK_OUTPUT is required for this isolated download test.');
app.setPath('userData',path.join(output,'user-data'));
app.whenReady().then(async()=>{
 let agent;
 try{
  await fs.mkdir(output,{recursive:true});
  const manifest=await(await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
  const version=manifest.versions.find(v=>v.id==='1.21.1');
  agent=require(path.join(base,'src/network.cjs')).downloadAgent;
  const localRequire=require('node:module').createRequire(path.join(base,'src/game.cjs'));
  const {download}=localRequire('@xmcl/file-transfer');
  await download({url:version.url,destination:path.join(output,'1.21.1.json'),validator:{algorithm:'sha1',hash:version.sha1},agent});
  const metadata=JSON.parse(await fs.readFile(path.join(output,'1.21.1.json'),'utf8'));
  if(metadata.id!=='1.21.1')throw Error('Wrong Minecraft metadata');
  const client=metadata.downloads.client;await download({url:client.url,destination:path.join(output,'1.21.1.jar'),validator:{algorithm:'sha1',hash:client.sha1},agent});
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,electron:process.versions.electron,sha1Verified:true,clientJarVerified:true}));
 }catch(e){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:false,error:require('node:util').inspect(e,{depth:7})}));app.exitCode=1;}
 finally{await agent?.dispatcher.close();app.exit(app.exitCode||0);}
});
