'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('startup',{
 state:()=>ipcRenderer.invoke('startup:state'),
 action:name=>ipcRenderer.invoke('startup:action',name),
 onUpdate:callback=>ipcRenderer.on('startup:update',(_event,state)=>callback(state))
});
