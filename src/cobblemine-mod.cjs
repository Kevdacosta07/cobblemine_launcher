'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),AdmZip=require('adm-zip');
const {noSymlinks}=require('./utils.cjs');
const legacy=new Set(['cobblemine_auth','cobblemine_grades','cobblemine_trainer','cobblemine_moderation','dinheiro_caisses']);
function identity(bytes){const zip=new AdmZip(bytes),entry=zip.getEntry('fabric.mod.json');return entry?JSON.parse(zip.readAsText(entry)).id:null;}
async function installCobblemine(instance,asset=path.join(__dirname,'../assets/cobblemine.jar')){
 const bytes=await fs.readFile(asset);if(identity(bytes)!=='cobblemine')throw Error('Le mod Cobblemine embarqué est invalide.');
 const mods=path.join(instance,'mods'),dest=path.join(mods,'cobblemine.jar');await fs.mkdir(mods,{recursive:true});await noSymlinks(instance,mods);
 const replace=[];let same=false;
 for(const name of await fs.readdir(mods)){if(!name.toLowerCase().endsWith('.jar'))continue;const file=path.join(mods,name);await noSymlinks(instance,file);const current=await fs.readFile(file);let id;try{id=identity(current);}catch{if(file===dest)throw Error('Le fichier cobblemine.jar existant est illisible.');continue;}
 if(file===dest){if(id!=='cobblemine')throw Error('Un autre mod utilise le nom cobblemine.jar.');same=current.equals(bytes);if(!same)replace.push(file);}
 else if(id==='cobblemine'||legacy.has(id))replace.push(file);
 }
 if(!replace.length&&same)return;
 const backup=path.join(instance,'.cobblemine','mod-backups',Date.now()+'-'+crypto.randomUUID());await noSymlinks(instance,backup);await fs.mkdir(backup,{recursive:true});
 const temp=path.join(mods,'.cobblemine-'+crypto.randomUUID()+'.tmp'),moved=[];let installed=false;
 try{if(!same)await fs.writeFile(temp,bytes,{flag:'wx'});for(const file of replace){const saved=path.join(backup,path.basename(file));await fs.rename(file,saved);moved.push([file,saved]);}if(!same){await fs.rename(temp,dest);installed=true;}}
 catch(error){if(installed)await fs.unlink(dest);for(const [file,saved]of moved.reverse())await fs.rename(saved,file);throw error;}
 finally{await fs.rm(temp,{force:true});}
}
module.exports={installCobblemine};
