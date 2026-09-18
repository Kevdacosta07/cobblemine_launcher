'use strict';
const os=require('node:os');
const {offlineSession}=require('./offline.cjs');
function defaults(config){return {authMode:'microsoft',offlineName:'',ram:Math.min(6,maxRam()),resolution:'1280x720',fullscreen:false,motion:true,serverAddress:config.serverAddress||'play.cobblemine.com',autoJoin:true,microsoftClientId:config.microsoftClientId||''};}
function maxRam(){return Math.max(2,Math.min(32,Math.floor(os.totalmem()/1073741824)-2));}
function validateSettings(v,config){if(!v||typeof v!=='object')throw Error('Réglages invalides.');const base=defaults(config);
 if(!Number.isInteger(v.ram)||v.ram<2||v.ram>maxRam())throw Error('Mémoire : choisis entre 2 et '+maxRam()+' Go.');
 if(!['1280x720','1600x900','1920x1080','2560x1440'].includes(v.resolution))throw Error('Résolution invalide.');
 for(const k of ['fullscreen','motion','autoJoin'])if(typeof v[k]!=='boolean')throw Error('Réglage invalide : '+k);
 const address=String(v.serverAddress||'').trim();if(address&&!/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::[0-9]{1,5})?$/.test(address))throw Error('Adresse de serveur invalide.');if(address.includes(':')&&(Number(address.split(':')[1])<1||Number(address.split(':')[1])>65535))throw Error('Port du serveur invalide.');
 const id=String(v.microsoftClientId||'').trim();if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('L’identifiant Microsoft doit être un identifiant d’application UUID.');
 const authMode=v.authMode??'microsoft';if(!['microsoft','offline'].includes(authMode))throw Error('Mode de connexion invalide.');
 const offlineName=String(v.offlineName||'').trim();if(offlineName||authMode==='offline')offlineSession(offlineName);
 return {...base,authMode,offlineName,ram:v.ram,resolution:v.resolution,fullscreen:v.fullscreen,motion:v.motion,autoJoin:v.autoJoin,serverAddress:address,microsoftClientId:id};}
module.exports={defaults,maxRam,validateSettings};

