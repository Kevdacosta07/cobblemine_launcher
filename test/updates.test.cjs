'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Updates,validateUpdateUrl}=require('../src/updates.cjs');
function setup(options={}){
 const updater=new EventEmitter();let installs=0,timer;
 updater.quitAndInstall=(silent,reopen)=>{assert.equal(silent,true);assert.equal(reopen,true);installs++;};
 updater.checkForUpdates=async()=>{updater.emit('update-not-available');return null;};
 const controller=new Updates({updater,configured:true,canInstall:()=>true,emit:()=>{},schedule:fn=>{timer=fn;return 1;},unschedule:()=>{timer=null;},...options});
 return {updater,controller,installs:()=>installs,tick:()=>timer?.()};
}
test('Une installation fraîche cherche les mises à jour et interdit le retour à une ancienne version',async()=>{
 const {controller,updater}=setup();await controller.check();assert.equal(controller.state.status,'current');assert.equal(updater.autoDownload,true);assert.equal(updater.autoInstallOnAppQuit,false);assert.equal(updater.allowDowngrade,false);
});
test('Téléchargement terminé : redémarrage automatique seulement après le délai',()=>{
 const s=setup();s.updater.emit('update-downloaded',{version:'0.2.0'});assert.equal(s.installs(),0);s.tick();assert.equal(s.installs(),1);assert.equal(s.controller.state.status,'installing');
});
test('Une interaction conserve la mise à jour prête sans interrompre le joueur',()=>{
 const s=setup();s.updater.emit('update-downloaded',{version:'0.2.0'});s.controller.defer();s.tick();assert.equal(s.installs(),0);assert.equal(s.controller.state.status,'ready');s.controller.install();assert.equal(s.installs(),1);
});
test('Une partie ou une installation en cours empêche le redémarrage',()=>{
 const s=setup({canInstall:()=>false});s.updater.emit('update-downloaded',{version:'0.2.0'});s.tick();assert.equal(s.installs(),0);assert.throws(()=>s.controller.install());assert.equal(s.controller.state.status,'ready');
});
test('Erreurs réseau et téléchargements refusés ne déclenchent jamais une installation',async()=>{
 const s=setup();s.updater.checkForUpdates=async()=>{throw Error('network unavailable');};await s.controller.check();assert.equal(s.controller.state.status,'error');assert.equal(s.installs(),0);
 s.updater.emit('error',Error('checksum mismatch'));assert.equal(s.controller.state.status,'error');assert.throws(()=>s.controller.install());
});
test('Deux vérifications simultanées ne lancent qu’une requête',async()=>{
 const s=setup();let finish,count=0;s.updater.checkForUpdates=()=>{count++;return new Promise(resolve=>{finish=resolve;});};const first=s.controller.check(),second=s.controller.check();assert.equal(count,1);finish(null);await Promise.all([first,second]);
});
test('Les versions sans hébergement ou en mode développement ne contactent pas le réseau',async()=>{
 for(const options of [{configured:false},{enabled:false}]){const s=setup(options);s.updater.checkForUpdates=()=>{throw Error('must not call');};await s.controller.check();assert.equal(s.controller.state.status,'disabled');}
});
test('Un hébergement alternatif doit utiliser HTTPS sans secrets',()=>{
 for(const url of ['http://example.org','file:///a','https://user:secret@example.org','https://example.org/?token=a'])assert.throws(()=>validateUpdateUrl(url));assert.equal(validateUpdateUrl('https://example.org/releases'),'https://example.org/releases/');
});
