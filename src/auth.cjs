'use strict';
const fs=require('node:fs/promises');const {setTimeout:delay}=require('node:timers/promises');
const {MicrosoftAuthenticator,MojangClient}=require('@xmcl/user');
const authority='https://login.microsoftonline.com/consumers/oauth2/v2.0';
const scope='XboxLive.signin offline_access';
class Auth{
 constructor(file,safeStorage,emit){this.file=file;this.safeStorage=safeStorage;this.emit=emit;this.session=null;}
 canStore(){return this.safeStorage.isEncryptionAvailable()&&!(process.platform==='linux'&&this.safeStorage.getSelectedStorageBackend()==='basic_text');}
 async load(){if(!this.canStore())return;try{this.session=JSON.parse(this.safeStorage.decryptString(await fs.readFile(this.file)));}catch{this.session=null;}}
 public(){return this.session?{name:this.session.profile.name,id:this.session.profile.id,persistent:this.canStore()}:null;}
 async save(){if(this.canStore()){await fs.writeFile(this.file,this.safeStorage.encryptString(JSON.stringify(this.session)),{mode:0o600});}}
 async logout(){this.session=null;await fs.unlink(this.file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 async tokenRequest(endpoint,data,signal){const r=await fetch(authority+endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});const result=await r.json();return {ok:r.ok,...result};}
 async exchange(ms,clientId,signal){const auth=new MicrosoftAuthenticator({fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])})});let minecraft,xuid;
 try{const {minecraftXstsResponse:xsts}=await auth.acquireXBoxToken(ms.access_token,signal);minecraft=await auth.loginMinecraftWithXBox(xsts.DisplayClaims.xui[0].uhs,xsts.Token,signal);xuid=xsts.DisplayClaims.xui[0].xid||minecraft.username;}
 catch(e){if(signal.aborted)throw e;throw Error('Microsoft/Xbox n’a pas autorisé l’accès à Minecraft. Vérifie le profil Xbox et l’autorisation Minecraft de l’application Cobblemine.');}
 const mojang=new MojangClient();let profile;try{profile=await mojang.getProfile(minecraft.access_token,signal);}catch{throw Error('Aucun profil Minecraft Java accessible. Vérifie que ce compte possède le jeu et un pseudo Java.');}
 if(!profile?.id||!profile?.name)throw Error('Profil Minecraft Java introuvable.');
 signal.throwIfAborted();this.session={clientId,xuid,refreshToken:ms.refresh_token,accessToken:minecraft.access_token,expires:Date.now()+minecraft.expires_in*1000,profile:{id:profile.id,name:profile.name}};await this.save();return this.public();}
 async login(clientId,signal){if(!clientId)throw Error('Configure l’identifiant d’application Microsoft dans Paramètres → Connexion Microsoft.');const device=await this.tokenRequest('/devicecode',{client_id:clientId,scope},signal);
 if(!device.ok||!device.device_code)throw Error('Microsoft refuse cette application. Vérifie son identifiant et l’activation des flux clients publics.');
 this.emit({type:'auth-code',code:device.user_code,url:'https://www.microsoft.com/devicelogin',expires:Date.now()+device.expires_in*1000});
 const end=Date.now()+device.expires_in*1000;let interval=Math.max(5,device.interval||5);
 while(Date.now()<end){await delay(interval*1000,undefined,{signal});const token=await this.tokenRequest('/token',{client_id:clientId,grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:device.device_code},signal);if(token.ok)return this.exchange(token,clientId,signal);if(token.error==='authorization_pending')continue;if(token.error==='slow_down'){interval+=5;continue;}throw Error(token.error==='authorization_declined'?'Connexion refusée.':'Code expiré ou connexion refusée. Relance la connexion.');}
 throw Error('Code expiré. Relance la connexion.');}
 async forLaunch(clientId,signal){if(!this.session||this.session.clientId!==clientId)throw Error('Connecte ton compte Microsoft avant de jouer.');
 if(this.session.expires>Date.now()+120000)return this.session;
 const token=await this.tokenRequest('/token',{client_id:clientId,grant_type:'refresh_token',refresh_token:this.session.refreshToken,scope},signal);if(!token.ok){await this.logout();throw Error('Session expirée. Reconnecte ton compte Microsoft.');}
 await this.exchange(token,clientId,signal);return this.session;}
}
module.exports={Auth};

