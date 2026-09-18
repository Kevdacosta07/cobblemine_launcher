'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,safeStorage,Menu,clipboard}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {Auth}=require('./cobblemine-auth.cjs'),{Game}=require('./game.cjs'),{inspectPack}=require('./packs.cjs');
const {defaults,maxRam,validateSettings}=require('./settings.cjs');
const {atomicJson,readJson,download,hashFile,httpsUrl,cleanError}=require('./utils.cjs');
const {offlineSession}=require('./offline.cjs');
const {Updates}=require('./updates.cjs');
const config=require('../launcher-config.json'),builtin=require('../builtin-pack.json');
config.serverAddress=config.serverAddress||'play.cobblemine.com';
if(process.platform==='win32')app.setAppUserModelId('com.cobblemine.launcher');
if(process.env.COBBLEMINE_TEST_DATA)app.setPath('userData',path.resolve(process.env.COBBLEMINE_TEST_DATA));
let splash,splashSlow=false,startupAttempt=0,openingMain=false,updates,win,root,settings,selection,installed,auth,game,operation=null,lastProgress=null,logFile;
const uiUrl=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
const emit=event=>{if(event.type==='launcher-update'&&splash&&!splash.isDestroyed())splash.webContents.send('startup:update',startupState());if(event.type==='progress')lastProgress=event;if(win&&!win.isDestroyed())win.webContents.send('cobblemine:event',event);if(event.type==='game-exit'){if(event.code)log('Minecraft terminé avec le code '+event.code);broadcast();}};
async function log(line){const secrets=[auth?.session?.accessToken,auth?.session?.refreshToken].filter(Boolean);let text=String(line);for(const secret of secrets)text=text.split(secret).join('[masqué]');text=text.replace(/(--accessToken\s+)\S+/gi,'$1[masqué]');await fs.appendFile(logFile,new Date().toISOString()+' '+text.slice(0,50000)+'\n').catch(()=>{});}
const publicState=()=>({version:app.getVersion(),update:updates?.state,settings,maxRam:maxRam(),account:auth.public(),authNotice:auth.notice,hasSavedSession:Boolean(auth.session),selection:selection?{name:selection.name}:null,builtin:builtin.name,installed:installed?{name:installed.packName,date:installed.installedAt}:null,busy:operation?.label||null,running:Boolean(game.child),progress:lastProgress,root});
function broadcast(){emit({type:'state',state:publicState()});}
function idle(){if(updates?.state.status==='installing')throw Error('Le launcher redémarre pour se mettre à jour.');if(operation||game.child)throw Error('Attends la fin de l’opération ou ferme Minecraft.');}
async function run(label,fn){idle();const controller=new AbortController();operation={label,controller};lastProgress=null;broadcast();try{return await fn(controller.signal);}catch(e){await log(cleanError(e));throw e;}finally{operation=null;lastProgress=null;broadcast();}}
function handle(name,fn){ipcMain.handle('cobblemine:'+name,async(event,...args)=>{try{if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==uiUrl)throw Error('Appel non autorisé.');return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:cleanError(e)};}});}
async function choosePack(){idle();const chosen=await dialog.showOpenDialog(win,{title:'Importer le modpack du serveur',filters:[{name:'Modpack Modrinth',extensions:['mrpack']}],properties:['openFile']});if(chosen.canceled)return null;
 return run('Import du modpack',async()=>{const file=chosen.filePaths[0];const info=await inspectPack(file);const target=path.join(root,'packs',info.id+'.mrpack');await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);selection={archive:target,name:info.plan.name};await atomicJson(path.join(root,'selection.json'),selection);installed=null;await atomicJson(path.join(root,'installed.json'),null);return {name:info.plan.name};});}
function wire(){
 handle('skin-avatar',()=>{const account=auth.public();return account?require('./skin-avatar.cjs').skinAvatar(account.name):null;});
 handle('check-launcher-update',async()=>{idle();await openStartup();return null;});
 handle('install-launcher-update',()=>updates.install());
 handle('defer-launcher-update',()=>updates.defer());
 handle('state',async()=>{if(process.argv.includes('--smoke-test')){await atomicJson(path.join(root,'smoke-result.json'),{ok:true,preload:true,renderer:true,encryptedStorage:auth.canStore(),platform:process.platform});setTimeout(()=>app.quit(),1200);}return publicState();});
 handle('save-settings',async input=>{idle();const next=validateSettings({...input,authMode:'microsoft',offlineName:'',microsoftClientId:''},config);await atomicJson(path.join(root,'preferences.json'),next);settings=next;broadcast();return publicState();});
 handle('reset-settings',async()=>{idle();const next={...defaults(config),microsoftClientId:settings.microsoftClientId,serverAddress:settings.serverAddress,authMode:settings.authMode,offlineName:settings.offlineName};await atomicJson(path.join(root,'preferences.json'),next);settings=next;broadcast();return publicState();});
 handle('login',async input=>{await run('Connexion Cobblemine',signal=>auth.login(input,signal));return publicState();});
 handle('restore-session',async()=>{await run('Vérification du compte',signal=>auth.refresh(signal));return publicState();});
 handle('open-register',()=>shell.openExternal('https://cobblemine.com/inscription'));
 handle('open-account',()=>shell.openExternal('https://cobblemine.com/compte'));
 handle('logout',async()=>{idle();await auth.logout();broadcast();});
 handle('open-shop',()=>{if(!config.shopUrl)throw Error('La boutique sera bientôt disponible.');return shell.openExternal(httpsUrl(config.shopUrl));});
 handle('open-microsoft',()=>shell.openExternal('https://www.microsoft.com/devicelogin'));
 handle('copy-code',code=>{if(typeof code!=='string'||!/^[-A-Z0-9]{5,20}$/.test(code))throw Error('Code invalide.');clipboard.writeText(code);});
 handle('cancel',()=>{if(operation)operation.controller.abort();});
 handle('import-pack',choosePack);
 handle('base-pack',async()=>{idle();selection=null;installed=null;await atomicJson(path.join(root,'selection.json'),null);await atomicJson(path.join(root,'installed.json'),null);broadcast();});
 handle('install',()=>run('Installation',async signal=>{installed=await game.install(selection,signal);return publicState();}));
 handle('play',()=>run('Préparation du jeu',async signal=>{await auth.refresh(signal);installed=await game.install(selection,signal);signal.throwIfAborted();const session=await auth.forLaunch(signal);await game.launch(installed,settings,session,log,auth);return publicState();}));
 handle('update-pack',()=>run('Mise à jour du modpack',async signal=>{if(!config.packUrl||!/^[a-f0-9]{128}$/i.test(config.packSha512))throw Error('Aucun modpack distant publié. Importe un fichier .mrpack pour le moment.');httpsUrl(config.packUrl);const archive=path.join(root,'packs',config.packSha512.slice(0,24)+'.mrpack');await download(config.packUrl,archive,{hash:config.packSha512,signal});const info=await inspectPack(archive);selection={archive,name:info.plan.name};await atomicJson(path.join(root,'selection.json'),selection);installed=await game.install(selection,signal);return publicState();}));
 handle('open-folder',async()=>{await fs.mkdir(installed?.instance||root,{recursive:true});const result=await shell.openPath(installed?.instance||root);if(result)throw Error(result);});
 handle('open-logs',async()=>{const result=await shell.openPath(logFile);if(result)throw Error(result);});
 handle('copy-server',()=>{clipboard.writeText(settings.serverAddress);});
}
async function createWindow(){
 win=new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:680,title:'Cobblemine',backgroundColor:'#FFFFFF',icon:path.join(__dirname,'../ui/assets/app-icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==uiUrl)event.preventDefault();});
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.webContents.session.setPermissionCheckHandler(()=>false);
 win.on('close',event=>{if(operation||game.child){event.preventDefault();dialog.showMessageBox(win,{type:'info',title:'Cobblemine',message:game.child?'Ferme Minecraft avant de quitter le launcher.':'Annule l’opération en cours avant de quitter le launcher.',buttons:['Compris']});}});
 win.once('ready-to-show',()=>{if(!process.argv.includes('--smoke-test'))win.show();});win.webContents.on('preload-error',(_event,_preload,error)=>log('PRELOAD_ERROR '+cleanError(error)));await win.loadFile(path.join(__dirname,'../ui/index.html'));await log('Interface chargée.');
}

const startupUrl=pathToFileURL(path.join(__dirname,'../ui/startup.html')).href;
function startupState(){return {version:app.getVersion(),update:updates?.state,slow:splashSlow};}
function verifyStartup(event){if(!splash||splash.isDestroyed()||event.sender!==splash.webContents||event.senderFrame!==splash.webContents.mainFrame||event.senderFrame.url!==startupUrl)throw Error('Appel non autorisé.');}
function wireStartup(){
 ipcMain.handle('startup:state',event=>{verifyStartup(event);return startupState();});
 ipcMain.handle('startup:action',async(event,name)=>{verifyStartup(event);if(name==='close'){app.quit();return;}if(updates.state.status==='installing')return;if(name==='continue'&&(splashSlow||updates.state.status==='error')){updates.defer();await openMain();}else if(name==='retry'&&updates.state.status==='error'){void checkStartup();}});
}
async function openMain(){
 if(openingMain)return;openingMain=true;++startupAttempt;
 try{if(!win||win.isDestroyed())await createWindow();else if(!process.argv.includes('--smoke-test'))win.show();if(splash&&!splash.isDestroyed()){splash.destroy();splash=null;}}finally{openingMain=false;}
}
async function checkStartup(){
 const attempt=++startupAttempt;splashSlow=false;
 const timeout=setTimeout(()=>{if(attempt===startupAttempt&&splash&&!splash.isDestroyed()&&updates.state.status==='checking'){splashSlow=true;splash.webContents.send('startup:update',startupState());}},20000);
 try{
  await updates.check();if(attempt!==startupAttempt||!splash||splash.isDestroyed())return;
  if(updates.state.status==='ready'){await new Promise(resolve=>setTimeout(resolve,700));if(attempt===startupAttempt&&splash&&!splash.isDestroyed())updates.install();}
  else if(['current','disabled'].includes(updates.state.status)){await new Promise(resolve=>setTimeout(resolve,650));if(attempt===startupAttempt)await openMain();}
 }finally{clearTimeout(timeout);}
}
async function openStartup(){
 if(splash&&!splash.isDestroyed()){splash.focus();return;}win?.hide();
 splash=new BrowserWindow({width:620,height:500,frame:false,resizable:false,maximizable:false,center:true,show:false,title:'Cobblemine',backgroundColor:'#FFFFFF',icon:path.join(__dirname,'../ui/assets/app-icon.png'),webPreferences:{preload:path.join(__dirname,'startup-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 splash.webContents.setWindowOpenHandler(()=>({action:'deny'}));splash.webContents.on('will-navigate',event=>event.preventDefault());splash.on('closed',()=>{++startupAttempt;if(!openingMain&&win&&!win.isDestroyed()&&!win.isVisible())app.quit();});
 splash.once('ready-to-show',()=>{if(!process.argv.includes('--smoke-test'))splash.show();});await splash.loadFile(path.join(__dirname,'../ui/startup.html'));
 if(process.argv.includes('--smoke-test')){await new Promise(resolve=>setTimeout(resolve,200));const shot=await splash.webContents.capturePage().catch(()=>null);if(shot)await fs.writeFile(path.join(root,'startup.png'),shot.toPNG());}
 void checkStartup().catch(async e=>{await log(cleanError(e));updates.fail(e);});
}

if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{const target=splash&&!splash.isDestroyed()?splash:win;if(target){if(target.isMinimized())target.restore();target.focus();}});
 app.whenReady().then(async()=>{root=app.getPath('userData');await fs.mkdir(root,{recursive:true});logFile=path.join(root,'launcher.log');const stat=await fs.stat(logFile).catch(()=>null);if(stat?.size>2*1024**2)await fs.rename(logFile,logFile+'.previous').catch(()=>{});await log('Démarrage Cobblemine '+app.getVersion());settings=await readJson(path.join(root,'preferences.json'),defaults(config));try{settings=validateSettings(settings,config);}catch{settings=defaults(config);}
 selection=await readJson(path.join(root,'selection.json'),null);installed=await readJson(path.join(root,'installed.json'),null);
 settings={...settings,authMode:'microsoft',offlineName:'',microsoftClientId:''};
 auth=new Auth(path.join(root,'cobblemine-account.encrypted'),safeStorage,emit);await auth.load();game=new Game(root,emit);Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{label:'Cobblemine',submenu:[{role:'about'},{role:'quit'}]},{role:'editMenu'},{role:'windowMenu'}]):null);updates=new Updates({updater:require('electron-updater').autoUpdater,autoRestart:false,configured:config.updateProvider==='github',url:config.updateUrl,enabled:app.isPackaged&&!process.argv.includes('--smoke-test')&&(process.platform!=='linux'||Boolean(process.env.APPIMAGE)),canInstall:()=>!operation&&!game.child,emit,log});wire();wireStartup();await openStartup();}).catch(async e=>{await log(e.stack||e.message);if(process.argv.includes('--smoke-test')){app.exit(1);return;}dialog.showErrorBox('Impossible de démarrer Cobblemine',cleanError(e));app.quit();});
 app.on('window-all-closed',()=>app.quit());
}
