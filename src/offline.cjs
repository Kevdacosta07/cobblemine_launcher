'use strict';
const {createHash}=require('node:crypto');
function offlineSession(name){
 if(typeof name!=='string'||! /^[A-Za-z0-9_]{3,16}$/.test(name))throw Error('Le pseudo doit contenir 3 à 16 lettres, chiffres ou tirets bas.');
 const bytes=createHash('md5').update('OfflinePlayer:'+name,'utf8').digest();
 bytes[6]=(bytes[6]&15)|48;bytes[8]=(bytes[8]&63)|128;
 return {offline:true,accessToken:'0',clientId:'',xuid:'0',profile:{name,id:bytes.toString('hex')}};
}
module.exports={offlineSession};
