'use strict';
const cache=new Map();
async function skinAvatar(username){
 if(!/^[A-Za-z0-9_]{3,16}$/.test(username))return null;
 const hit=cache.get(username);if(hit&&hit.until>Date.now())return hit.data;
 try{
  const profile=await fetch('https://api.mojang.com/users/profiles/minecraft/'+encodeURIComponent(username),{redirect:'error',signal:AbortSignal.timeout(5000)});
  const account=profile.ok?await profile.json():null;
  const uuid=account?.id;if(!/^[a-f0-9]{32}$/i.test(uuid||''))return null;
  const image=await fetch('https://minotar.net/helm/'+uuid+'/64.png',{redirect:'error',signal:AbortSignal.timeout(7000)});
  if(!image.ok||!image.headers.get('content-type')?.startsWith('image/png'))return null;
  const bytes=Buffer.from(await image.arrayBuffer());if(bytes.length>65536||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return null;
  const data='data:image/png;base64,'+bytes.toString('base64');if(cache.size>100)cache.clear();cache.set(username,{data,until:Date.now()+300000});return data;
 }catch{return null;}
}
module.exports={skinAvatar};
