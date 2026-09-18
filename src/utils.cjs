'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createReadStream,createWriteStream}=require('node:fs');
const {Readable,Transform}=require('node:stream');const {pipeline}=require('node:stream/promises');
function safePath(root,relative){if(typeof relative!=='string'||!relative||relative.length>240||relative.includes('\\')||relative.includes(':')||relative.startsWith('/')||/[\x00-\x1f]/.test(relative))throw Error('Chemin de fichier interdit.');
 const parts=relative.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)))throw Error('Chemin de fichier interdit.');
 const result=path.resolve(root,...parts);if(!result.startsWith(path.resolve(root)+path.sep))throw Error('Chemin hors du dossier de jeu.');return result;}
async function noSymlinks(root,target){const rel=path.relative(root,target);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Chemin hors du dossier.');let current=root;for(const p of ['.',...rel.split(path.sep)]){current=path.join(current,p);const stat=await fs.lstat(current).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(stat?.isSymbolicLink())throw Error('Lien symbolique refusé dans le modpack.');}}
function httpsUrl(value,hosts){let u;try{u=new URL(value);}catch{throw Error('Adresse HTTPS invalide.');}if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.startsWith('[')||(hosts&&!hosts.includes(u.hostname)))throw Error('Adresse de téléchargement non autorisée.');return u.href;}
async function response(url,{signal,headers={},...options}={}){let current=httpsUrl(url);for(let i=0;i<6;i++){const r=await fetch(current,{...options,headers:{'User-Agent':'Cobblemine/0.1.0 (Minecraft launcher)',...headers},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),redirect:'manual'});if([301,302,303,307,308].includes(r.status)){await r.body?.cancel();current=httpsUrl(new URL(r.headers.get('location'),current).href);continue;}return r;}throw Error('Trop de redirections.');}
async function json(url,options){const r=await response(url,options);if(!r.ok){await r.body?.cancel();throw Error('Service indisponible (HTTP '+r.status+').');}return r.json();}
async function hashFile(file,algorithm='sha512'){const hash=crypto.createHash(algorithm);for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function atomicJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);}
async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return fallback;throw e;}}
async function download(url,file,{hash,algorithm='sha512',size,signal,onProgress,limit=1024*1024*1024}={}){httpsUrl(url);signal?.throwIfAborted();if(hash&&await hashFile(file,algorithm).catch(()=>null)===hash)return;
 await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.part';let last;
 for(let attempt=0;attempt<3;attempt++){signal?.throwIfAborted();let bytes=0;const h=crypto.createHash(algorithm);try{const r=await response(url,{signal});if(!r.ok){await r.body?.cancel();throw Error('Téléchargement refusé (HTTP '+r.status+').');}
 const total=Number(r.headers.get('content-length'))||size||0;if(total>limit){await r.body.cancel();throw Error('Fichier trop volumineux.');}
 const meter=new Transform({transform(chunk,enc,cb){bytes+=chunk.length;if(bytes>limit)return cb(Error('Fichier trop volumineux.'));h.update(chunk);onProgress?.(bytes,total);cb(null,chunk);}});
 await pipeline(Readable.fromWeb(r.body),meter,createWriteStream(temp,{mode:0o600}),{signal});
 if(size!==undefined&&bytes!==size)throw Error('Taille du fichier incorrecte.');if(hash&&h.digest('hex')!==hash)throw Error('Intégrité du fichier incorrecte.');
 await fs.rename(temp,file);return;
 }catch(e){last=e;await fs.unlink(temp).catch(()=>{});if(signal?.aborted)throw e;}}
 throw last;}
function cleanError(e){if(e?.name==='AbortError'||e?.name==='CancelError')return 'Opération annulée.';return String(e?.message||e||'Erreur inconnue').replace(/(Bearer\s+|access_token[=: ]+|refresh_token[=: ]+)\S+/gi,'$1[masqué]').slice(0,500);}
module.exports={safePath,noSymlinks,httpsUrl,response,json,hashFile,atomicJson,readJson,download,cleanError};

