import { Studio } from './core';
export const studio=new Studio();await studio.init();
const json=(v:unknown,status=200)=>Response.json(v,{status});
Bun.serve({hostname:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||8787),maxRequestBodySize:50*1024*1024,async fetch(req){const u=new URL(req.url);const p=u.pathname.split('/').filter(Boolean);try{
 if(u.pathname==='/health')return json({ok:true,paymentConfigured:false,capabilities:{clip:true,frames:true,convert:true,normalize:true,repair_subtitles:'timestamp punctuation only',transcribe:false,localize:false,ocr:false}});
 if(req.method==='POST'&&u.pathname==='/assets')return json(await studio.upload(new Uint8Array(await req.arrayBuffer())),201);
 if(req.method==='GET'&&p[0]==='assets'&&p.length===2)return json(await studio.read('assets',p[1]!));
 if(req.method==='GET'&&p[0]==='quotes'&&p.length===2)return json(await studio.read('quotes',p[1]!));
 if(req.method==='POST'&&u.pathname==='/quotes')return json(await studio.quote(await req.json()),201);
 if(req.method==='POST'&&u.pathname==='/workflows')return json({error:'Payment is unconfigured. No recipient or facilitator is set; no payment accepted.'},503);
 if(req.method==='POST'&&u.pathname==='/dev/workflows'){if(!process.env.LOCAL_DEV_TOKEN||req.headers.get('authorization')!==`Bearer ${process.env.LOCAL_DEV_TOKEN}`)return json({error:'Local development route disabled or unauthorized'},403);const b=await req.json();return json(await studio.enqueue(b.quoteId,b.idempotencyKey),202)}
 if(req.method==='GET'&&p[0]==='jobs'&&p.length===2)return json(await studio.read('jobs',p[1]!));
 if(req.method==='GET'&&p[0]==='jobs'&&p[2]==='artifacts'&&p.length===4){const j=await studio.read('jobs',p[1]!);if(j.status!=='succeeded'||!j.artifacts.some((a:any)=>a.name===p[3]))return json({error:'Artifact unavailable'},404);return new Response(Bun.file(studio.path('jobs',j.id,p[3]!)),{headers:{'content-disposition':`attachment; filename="${p[3]}"`}})}
 return json({error:'Not found'},404);
 }catch(e:any){return json({error:e.code==='ENOENT'?'Not found':e.message},e.code==='ENOENT'?404:400)}}});
console.error('Media Studio listening on loopback port '+(process.env.PORT||8787));
