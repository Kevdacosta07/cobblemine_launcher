'use strict';
const fs=require('node:fs/promises');
const {offlineSession}=require('./offline.cjs');
const API='https://api.cobblemine.com';
class Auth {
 constructor(file,safeStorage,_emit,fetcher=fetch){this.file=file;this.safeStorage=safeStorage;this.fetch=fetcher;this.session=null;this.verified=false;this.notice='';}
 canStore(){return this.safeStorage.isEncryptionAvailable()&&!(process.platform==='linux'&&this.safeStorage.getSelectedStorageBackend()==='basic_text');}
 public(){if(!this.verified||!this.session)return null;const a=this.session.account;return {name:a.username,id:a.minecraftUuid.replaceAll('-',''),accountId:a.id,points:a.points,grades:a.grades,roles:a.roles,persistent:this.canStore()};}
 account(value){if(!value||typeof value.id!=='string'||typeof value.username!=='string'||typeof value.minecraftUuid!=='string')throw Error('Réponse du serveur invalide.');const game=offlineSession(value.username);if(value.minecraftUuid.replaceAll('-','')!==game.profile.id)throw Error('Identité Minecraft incohérente.');return {id:value.id,username:value.username,minecraftUuid:value.minecraftUuid,points:/^\d+$/.test(value.points)?String(value.points):'0',grades:Array.isArray(value.grades)?value.grades:[],roles:Array.isArray(value.roles)?value.roles:[]};}
 async request(route,{body,token,signal}={}){
  let response;try{response=await this.fetch(API+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(12000)])});}catch{if(signal?.aborted)throw Error('Connexion annulée.');throw Error('Impossible de joindre Cobblemine. Vérifie ta connexion et réessaie.');}
  if(response.status===204)return null;
  const data=await response.json().catch(()=>null);
  if(!response.ok){const error=Error(response.status===429?'Trop de tentatives. Réessaie dans quelques minutes.':response.status===401?'Identifiants incorrects ou session expirée. Reconnecte-toi.':'Le service Cobblemine est momentanément indisponible.');error.status=response.status;throw error;}
  return data;
 }
 async save(){if(!this.canStore()){this.notice='Tu resteras connecté jusqu’à la fermeture du launcher.';return;}
  const temporary=this.file+'.tmp';try{await fs.writeFile(temporary,this.safeStorage.encryptString(JSON.stringify(this.session)),{mode:0o600});await fs.rename(temporary,this.file);}catch{await fs.unlink(temporary).catch(()=>{});this.notice='Session ouverte. La reconnexion automatique n’a pas pu être enregistrée.';}
 }
 async load(){this.verified=false;if(!this.canStore())return;try{this.session=JSON.parse(this.safeStorage.decryptString(await fs.readFile(this.file)));if(!/^[A-Za-z0-9_-]{43}$/.test(this.session.accessToken)||!Number.isFinite(Date.parse(this.session.expiresAt)))throw Error();}catch{this.session=null;return;}
  try{await this.refresh();}catch(e){this.notice=e.message;}
 }
 async login(input,signal){if(!input||typeof input.login!=='string'||!input.login.trim()||input.login.length>254||typeof input.password!=='string'||!input.password||input.password.length>128)throw Error('Saisis ton pseudo ou ton email et ton mot de passe.');
  const data=await this.request('/v1/auth/login',{body:{login:input.login.trim(),password:input.password},signal});
  if(!data||!/^[A-Za-z0-9_-]{43}$/.test(data.accessToken)||!(Date.parse(data.expiresAt)>Date.now()))throw Error('Session reçue invalide.');
  const account=this.account(data.account);this.session={accessToken:data.accessToken,expiresAt:data.expiresAt,account};this.verified=true;this.notice='';await this.save();return this.public();
 }
 async clear(){this.session=null;this.verified=false;await fs.unlink(this.file).catch(e=>{if(e.code!=='ENOENT')throw Error('Impossible de supprimer la session enregistrée.');});}
 async refresh(signal){this.verified=false;if(!this.session)throw Error('Connecte-toi avec ton compte Cobblemine.');if(Date.parse(this.session.expiresAt)<=Date.now()){await this.clear();throw Error('Ta session a expiré. Reconnecte-toi.');}
  try{this.session.account=this.account(await this.request('/v1/me',{token:this.session.accessToken,signal}));this.verified=true;this.notice='';return this.public();}catch(e){if(e.status===401)await this.clear();throw e;}
 }
 async logout(){if(this.session){try{await this.request('/v1/auth/logout',{body:{},token:this.session.accessToken});}catch(e){if(e.status!==401)throw e;}}await this.clear();this.notice='';}
 async forLaunch(signal){await this.refresh(signal);return offlineSession(this.session.account.username);}
}
module.exports={Auth};
