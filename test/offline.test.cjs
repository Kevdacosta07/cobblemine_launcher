'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {offlineSession}=require('../src/offline.cjs');
const {defaults,validateSettings}=require('../src/settings.cjs');
test('Identité locale compatible avec le UUID OfflinePlayer de Minecraft',()=>{
 const s=offlineSession('Steve');assert.equal(s.profile.id,'5627dd98e6be3c21b8a8e92344183641');
 assert.deepEqual(s,offlineSession('Steve'));assert.notEqual(s.profile.id,offlineSession('steve').profile.id);assert.equal(s.accessToken,'0');
});
test('Les pseudos invalides et modes inconnus sont refusés avant lancement',()=>{
 for(const name of ['', 'ab', 'abcdefghijklmnopq', '../Kevin', 'Kevin Test', 'Kévin', '--demo', null])assert.throws(()=>offlineSession(name));
 const base=defaults({});assert.throws(()=>validateSettings({...base,authMode:'offline'},{}));assert.throws(()=>validateSettings({...base,authMode:'invalid'},{}));
 assert.equal(validateSettings({...base,authMode:'offline',offlineName:' Kevin_01 '},{}).offlineName,'Kevin_01');
});
test('Les anciens réglages Microsoft restent compatibles',()=>{
 const old=defaults({});delete old.authMode;delete old.offlineName;
 assert.equal(validateSettings(old,{}).authMode,'microsoft');
});
