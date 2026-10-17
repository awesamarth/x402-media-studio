import {Payments,paymentConfig} from './payments';
import {createHash} from 'node:crypto';
import { Studio } from './core';
export const studio=new Studio();await studio.init();
const config=paymentConfig();const payments=new Payments(studio,config);
const owner=createHash('sha256').update(process.env.LOCAL_DEV_TOKEN||'disabled').digest('hex');
let receivingUpload=false;
const json=(v:unknown,status=200)=>Response.json(v,{status});
Bun.serve({hostname:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||8787),maxRequestBodySize:50*1024*1024,async fetch(req){const u=new URL(req.url);const p=u.pathname.split('/').filter(Boolean);try{
 if(u.pathname==='/health')return json({ok:true,paymentConfigured:false,capabilities:{clip:true,frames:true,convert:true,normalize:true,repair_subtitles:'SRT/VTT validation, reflow and explicit overlap handling',transcribe:false,localize:false,ocr:false}});
 if(u.pathname!=='/workflows' && (!process.env.LOCAL_DEV_TOKEN||req.headers.get('authorization')!==`Bearer ${process.env.LOCAL_DEV_TOKEN}`))return json({error:'Configure LOCAL_DEV_TOKEN and provide its Bearer token'},401);
 if(req.method==='POST'&&u.pathname==='/assets'){if(receivingUpload)return json({error:'One upload at a time; retry later'},429);receivingUpload=true;try{return json(await studio.upload(new Uint8Array(await req.arrayBuffer())),201)}finally{receivingUpload=false}}
 if(req.method==='GET'&&p[0]==='assets'&&p.length===2)return json(await studio.read('assets',p[1]!));
 if(req.method==='GET'&&p[0]==='quotes'&&p.length===2){const q=await studio.read('quotes',p[1]!);if(q.owner!==owner)return json({error:'Not found'},404);let paymentStatus='unpaid';try{paymentStatus=(await studio.read('payments',q.id)).status}catch{}return json({...q,paymentConfigured:false,paymentStatus})};
 if(req.method==='POST'&&u.pathname==='/quotes')return json({...await studio.quote(await req.json(),owner),paymentConfigured:false},201);
 if(req.method==='POST'&&u.pathname==='/workflows')return await payments.purchase(config?await req.json():null,req.headers.get('PAYMENT-SIGNATURE'));
 if(req.method==='POST'&&u.pathname==='/dev/workflows'){if(config)return json({error:'Development enqueue is disabled when payments are enabled'},403);if(!process.env.LOCAL_DEV_TOKEN||req.headers.get('authorization')!==`Bearer ${process.env.LOCAL_DEV_TOKEN}`)return json({error:'Local development route disabled or unauthorized'},403);const b=await req.json();const q=await studio.read('quotes',b.quoteId);if(q.owner!==owner)return json({error:'Not found'},404);return json(await studio.enqueue(b.quoteId,b.idempotencyKey),202)}
 if(req.method==='GET'&&p[0]==='jobs'&&p.length===2){const j=await studio.read('jobs',p[1]!);return j.owner===owner?json({...j,artifacts:j.artifacts.map((a:any)=>({...a,downloadPath:`/jobs/${j.id}/artifacts/${a.name}`}))}):json({error:'Not found'},404)};
 if(req.method==='GET'&&p[0]==='jobs'&&p[2]==='artifacts'&&p.length===4){const j=await studio.read('jobs',p[1]!);if(j.owner!==owner||j.status!=='succeeded'||!j.artifacts.some((a:any)=>a.name===p[3]))return json({error:'Artifact unavailable'},404);const file=Bun.file(studio.path('jobs',j.id,p[3]!));if(u.searchParams.get('inline')==='base64'){if(file.size>49152)return json({error:'Artifact too large for tool; use authenticated downloadPath'},413);return json({name:p[3],encoding:'base64',bytes:file.size,data:Buffer.from(await file.arrayBuffer()).toString('base64')})}return new Response(file,{headers:{'content-disposition':`attachment; filename="${p[3]}"`}})}
 return json({error:'Not found'},404);
 }catch(e:any){return json({error:e.code==='ENOENT'?'Not found':e.message},e.code==='ENOENT'?404:400)}}});
console.error('Media Studio listening on loopback port '+(process.env.PORT||8787));
