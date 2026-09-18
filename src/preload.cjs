'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const api={};for(const name of ['check-launcher-update','install-launcher-update','defer-launcher-update','state','save-settings','reset-settings','login','logout','restore-session','open-register','open-account','open-microsoft','open-shop','copy-code','cancel','import-pack','base-pack','install','play','update-pack','open-folder','open-logs','copy-server'])api[name]=async(...args)=>{const result=await ipcRenderer.invoke('cobblemine:'+name,...args);if(!result.ok)throw Error(result.error);return result.value;};
api.onEvent=callback=>{const handler=(_event,event)=>callback(event);ipcRenderer.on('cobblemine:event',handler);return ()=>ipcRenderer.removeListener('cobblemine:event',handler);};
contextBridge.exposeInMainWorld('cobblemine',api);

