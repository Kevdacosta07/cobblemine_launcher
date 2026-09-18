'use strict';
const http=require('node:http'),crypto=require('node:crypto');
function address(value){return String(value).trim().toLowerCase().replace(/:25565$/,'');}
async function startBridge(auth,servers){
 const secret=crypto.randomBytes(32).toString('base64url');let busy=false,last=0;
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+secret);
  if(req.method!=='POST'||req.url!=='/ticket'||req.headers.origin||supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){send(403,{error:'LAUNCHER_REQUIRED'});return;}
  if(busy||Date.now()-last<1000){send(429,{error:'RETRY_LATER'});return;}
  busy=true;
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024){send(413,{error:'INVALID_REQUEST'});return;}}
   const input=JSON.parse(raw);const target=servers.find(s=>s.id===input.serverId&&s.addresses.some(a=>address(a)===address(input.address)));
   if(!target){send(403,{error:'UNKNOWN_SERVER'});return;}
   last=Date.now();const ticket=await auth.joinTicket(target.id);send(200,{ticket});
  }catch(error){send(error.status===401?401:503,{error:error.status===401?'RECONNECT_LAUNCHER':'SERVICE_UNAVAILABLE'});}finally{busy=false;}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {env:{COBBLEMINE_BRIDGE_PORT:String(server.address().port),COBBLEMINE_BRIDGE_SECRET:secret},close:()=>{server.close();server.closeAllConnections();}};
}
module.exports={startBridge};
