'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');const {promisify}=require('node:util');
const {Game}=require('../src/game.cjs');
(async()=>{
 const root=path.resolve('.ci-smoke');await fs.mkdir(root,{recursive:true});
 const java=await new Game(path.join(root,'runtime-check'),()=>{}).ensureJava(AbortSignal.timeout(600000));
 const version=await promisify(execFile)(java,['-version'],{windowsHide:true});assert.match(version.stdout+version.stderr,/version "21[.\"]/);
 const executable=process.platform==='win32'?'dist/win-unpacked/Cobblemine.exe':process.platform==='darwin'?`dist/${process.arch==='arm64'?'mac-arm64':'mac'}/Cobblemine.app/Contents/MacOS/Cobblemine`:'dist/linux-unpacked/cobblemine';
 const resultFile=path.join(root,'smoke-result.json');await fs.rm(resultFile,{force:true});
 await new Promise((resolve,reject)=>{
  // Only the isolated Linux CI runner needs this Chromium flag; never shipped to players.
  const args=['--smoke-test',...(process.platform==='linux'?['--no-sandbox']:[])];
  const child=spawn(path.resolve(executable),args,{windowsHide:true,env:{...process.env,COBBLEMINE_TEST_DATA:root},stdio:'inherit'});
  const timer=setTimeout(()=>{child.kill();reject(Error('Packaged launcher smoke test timed out'));},90000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Launcher exit '+code));});
 });
 const result=JSON.parse(await fs.readFile(resultFile,'utf8'));assert.equal(result.ok,true);assert.equal(result.preload,true);assert.equal(result.renderer,true);assert.equal(result.platform,process.platform);
 await fs.writeFile('dist/platform-check.json',JSON.stringify({...result,arch:process.arch,java21:true,version:require('../package.json').version},null,2));console.log('Native Java and packaged launcher verified:',process.platform,process.arch);
})().catch(e=>{console.error(e);process.exitCode=1});
