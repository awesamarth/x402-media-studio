import {Imports} from './imports';
import {MAX_UPLOAD_BYTES} from './limits';
import {aiCapabilities} from './local-ai';
import {loadAccounts,principal} from './accounts';
import {Payments,paymentConfig,billingMode} from './payments';
import {createHash} from 'node:crypto';
import { Studio } from './core';
export const studio=new Studio();await studio.init();
const mode=billingMode();const config=paymentConfig();const payments=new Payments(studio,config);
const accounts=loadAccounts();
const imports=new Imports(studio);await imports.init();
let receivingUpload=false;
const json=(v:unknown,status=200)=>Response.json(v,{status});
const httpServer=Bun.serve({hostname:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||8787),maxRequestBodySize:MAX_UPLOAD_BYTES,async fetch(req){const u=new URL(req.url);const p=u.pathname.split('/').filter(Boolean);const owner=principal(req.headers.get('authorization'),accounts);try{
 if(u.pathname==='/health')return json({ok:true,mode,paymentConfigured:Boolean(config),capabilities:{clip:true,frames:true,convert:true,normalize:true,repair_subtitles:'SRT/VTT validation, reflow and explicit overlap handling',...await aiCapabilities()}});
 if(!(u.pathname==='/workflows'&&mode==='paid') && !owner)return json({error:'Configure LOCAL_DEV_TOKEN and provide its Bearer token'},401);
 if(req.method==='POST'&&u.pathname==='/imports'){if(mode!=='free')return json({error:'URL import currently requires free billing mode'},409);return json(await imports.enqueue(await req.json(),owner!),202)}
 if(req.method==='GET'&&p[0]==='imports'&&p.length===2)return json(await imports.get(p[1]!,owner!));
 if(req.method==='POST'&&u.pathname==='/assets'){if(receivingUpload)return json({error:'One upload at a time; retry later'},429);receivingUpload=true;try{return json(await studio.upload(new Uint8Array(await req.arrayBuffer()),owner),201)}finally{receivingUpload=false}}
 if(req.method==='GET'&&p[0]==='assets'&&p.length===2)return json(await studio.asset(p[1]!,owner!));
 if(req.method==='GET'&&p[0]==='quotes'&&p.length===2){const q=await studio.read('quotes',p[1]!);if(q.owner!==owner)return json({error:'Not found'},404);let purchase:any;try{purchase=await studio.read('payments',q.id)}catch{}let fulfillment:any;if(purchase?.status==='settled'){fulfillment=await payments.resume(owner!,q.id);if(fulfillment.notFound)return json({error:'Not found'},404)}let jobId;try{if(['settled','free'].includes(purchase?.status))jobId=(await studio.read('jobs',createHash('sha256').update(purchase.jobKey).digest('hex'))).id}catch{}return json({...q,paymentConfigured:Boolean(config)&&q.mode==='paid',paymentStatus:purchase?.status||'unpaid',...(fulfillment?{fulfillmentStatus:fulfillment.fulfillmentStatus,...(fulfillment.message?{fulfillmentMessage:fulfillment.message}:{})}:{}),...(jobId?{jobId}:{})})};
 if(req.method==='POST'&&u.pathname==='/quotes')return json({...await studio.quote(await req.json(),owner,mode),paymentConfigured:Boolean(config)},201);
 if(req.method==='POST'&&u.pathname==='/workflows')return mode==='free'?await payments.freePurchase(owner!,await req.json()):await payments.purchase(await req.json(),req.headers.get('PAYMENT-SIGNATURE'));
 if(req.method==='POST'&&u.pathname==='/dev/workflows')return json({error:'Use authenticated POST /workflows in free mode'},410);
 if(req.method==='GET'&&p[0]==='jobs'&&p.length===2){const j=await studio.read('jobs',p[1]!);return j.owner===owner?json({...j,artifacts:j.artifacts.map((a:any)=>({...a,downloadPath:`/jobs/${j.id}/artifacts/${a.name}`}))}):json({error:'Not found'},404)};
 if(req.method==='GET'&&p[0]==='jobs'&&p[2]==='artifacts'&&p.length===4){const j=await studio.read('jobs',p[1]!);if(j.owner!==owner||j.status!=='succeeded'||!j.artifacts.some((a:any)=>a.name===p[3]))return json({error:'Artifact unavailable'},404);const file=Bun.file(studio.path('jobs',j.id,p[3]!));if(u.searchParams.get('inline')==='base64'){if(file.size>49152)return json({error:'Artifact too large for tool; use authenticated downloadPath'},413);return json({name:p[3],encoding:'base64',bytes:file.size,data:Buffer.from(await file.arrayBuffer()).toString('base64')})}return new Response(file,{headers:{'content-disposition':`attachment; filename="${p[3]}"`}})}
 return json({error:'Not found'},404);
 }catch(e:any){return json({error:e.code==='ENOENT'?'Not found':e.message},e.code==='ENOENT'?404:400)}}});
console.error('Media Studio listening on loopback port '+httpServer.port);
if(process.env.MEDIA_TEST_READY==='1')console.log(JSON.stringify({event:'media-ready',port:httpServer.port,mode}));
