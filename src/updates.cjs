'use strict';
function validateUpdateUrl(value){
 if(!value)return '';
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Les mises à jour nécessitent une adresse HTTPS sans identifiants ni paramètres.');
 return u.href.replace(/\/?$/,'/');
}
class Updates{
 constructor({updater,url,configured=false,enabled=true,autoRestart=true,canInstall,emit,log=()=>{},schedule=setTimeout,unschedule=clearTimeout}){
  Object.assign(this,{updater,canInstall,emit,log,schedule,unschedule});this.timer=null;this.pending=null;this.interacted=false;
  this.state={status:'disabled',message:'Les mises à jour seront disponibles lorsque leur hébergement sera configuré.'};
  this.url=validateUpdateUrl(url);
  if((!this.url&&!configured)||!enabled)return;
  this.state={status:'idle',message:'Recherche automatique à chaque démarrage.'};
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.autoRunAppAfterInstall=true;updater.allowDowngrade=false;updater.allowPrerelease=false;
  updater.logger={info:()=>{},warn:m=>log('Mise à jour : '+m),error:m=>log('Mise à jour : '+m),debug:()=>{}};
  updater.on('checking-for-update',()=>this.set('checking','Recherche d’une nouvelle version…'));
  updater.on('update-available',info=>this.set('downloading','Téléchargement du launcher '+info.version+'…',{version:info.version}));
  updater.on('download-progress',p=>this.set('downloading','Téléchargement du launcher…',{version:this.state.version,percent:Math.max(0,Math.min(100,Math.round(p.percent||0)))}));
  updater.on('update-not-available',()=>this.set('current','Ton launcher est à jour.'));
  updater.on('error',e=>this.fail(e));
  updater.on('update-downloaded',info=>{
   this.set('ready',!autoRestart?'Nouvelle version prête à installer.':this.interacted?'Nouvelle version prête. Redémarre pour l’installer.':'Nouvelle version prête. Redémarrage dans 5 secondes…',{version:info.version});
   if(autoRestart&&!this.interacted)this.timer=schedule(()=>{this.timer=null;if(!this.interacted&&this.canInstall())this.install();else this.defer();},5000);
  });
 }
 set(status,message,extra={}){this.state={status,message,...extra};this.emit({type:'launcher-update',update:this.state});}
 fail(e){this.stopTimer();this.log('Mise à jour : '+String(e?.message||e));this.set('error','Mise à jour indisponible. Tu peux continuer à utiliser le launcher.');}
 stopTimer(){if(this.timer!==null){this.unschedule(this.timer);this.timer=null;}}
 defer(){this.interacted=true;this.stopTimer();if(this.state.status==='ready')this.set('ready','Nouvelle version prête. Redémarre pour l’installer.',{version:this.state.version});}
 async check(){
  if(['disabled','ready','installing','downloading'].includes(this.state.status))return this.state;
  if(this.pending)return this.pending;
  this.set('checking','Recherche d’une nouvelle version…');
  this.pending=(async()=>{try{const result=await this.updater.checkForUpdates();if(result?.downloadPromise)await result.downloadPromise;}catch(e){this.fail(e);}finally{this.pending=null;}return this.state;})();
  return this.pending;
 }
 install(){
  if(this.state.status!=='ready')throw Error('Aucune mise à jour prête à installer.');
  if(!this.canInstall())throw Error('Ferme Minecraft et attends la fin des opérations avant de redémarrer.');
  this.stopTimer();this.set('installing','Installation de la nouvelle version…');
  try{this.updater.quitAndInstall(true,true);}catch(e){this.fail(e);}
 }
}
module.exports={Updates,validateUpdateUrl};
