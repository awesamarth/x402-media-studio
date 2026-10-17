import {McpServer,createMcpHandler} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {randomUUID} from 'node:crypto';
import {request} from 'node:https';
import {lookup} from 'node:dns/promises';
import {checkServerIdentity} from 'node:tls';
import {isPublicIPv4} from './import-proxy';
import {MAX_UPLOAD_BYTES} from './limits';

/** Accept only temporary download references issued on OpenAI-controlled file hosts. Never persist URLs. */
export async function attachmentBytes(value:string):Promise<Uint8Array>{
 const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!(u.hostname==='files.openai.com'||u.hostname==='files.oaiusercontent.com'||u.hostname.endsWith('.oaiusercontent.com')))throw Error('Expected an authorized OpenAI file download URL; opaque attachment IDs and arbitrary public URLs are unsupported');
 const addresses=await lookup(u.hostname,{all:true,family:4});if(!addresses.length||addresses.some(a=>!isPublicIPv4(a.address)))throw Error('Attachment host must resolve to public addresses');
 return new Promise((resolve,reject)=>{let done=false,total=0;const chunks:Buffer[]=[];const timer=setTimeout(()=>finish(Error('Attachment download timed out')),90000);
 const req=request({hostname:addresses[0]!.address,servername:u.hostname,checkServerIdentity:(_,cert)=>checkServerIdentity(u.hostname,cert),port:443,path:u.pathname+u.search,method:'GET',agent:false,headers:{host:u.hostname,'accept-encoding':'identity'}},res=>{
 if(res.statusCode!==200){res.destroy();finish(Error('Attachment unavailable or expired (HTTP '+res.statusCode+'); ask the host for a fresh authorized reference'));return}
 if(Number(res.headers['content-length'])>MAX_UPLOAD_BYTES||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();finish(Error('Attachment exceeds upload bounds'));return}
 res.on('data',(c:Buffer)=>{total+=c.length;if(total>MAX_UPLOAD_BYTES){res.destroy();finish(Error('Attachment exceeds 100 MiB'))}else chunks.push(c)});res.on('error',()=>finish(Error('Attachment download interrupted')));res.on('end',()=>finish(total?undefined:Error('Attachment is empty')));
 });function finish(error?:Error){if(done)return;done=true;clearTimeout(timer);if(error){req.destroy();reject(error)}else resolve(new Uint8Array(Buffer.concat(chunks)))}req.setTimeout(20000,()=>finish(Error('Attachment connection timed out')));req.on('error',()=>finish(Error('Attachment connection failed')));req.end();
 });
}
const file=z.object({download_url:z.string().max(8192),file_id:z.string().min(1).max(256),mime_type:z.string().optional(),file_name:z.string().optional()}).strict();
const handle=z.string().regex(/^[a-f0-9]{64}$/);const id=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const steps=z.array(z.object({type:z.enum(['transcribe','localize','clip','frames','repair_subtitles','convert','normalize'])}).catchall(z.json())).min(1).max(8);
const result=(data:any)=>({content:[{type:'text' as const,text:JSON.stringify(data)}],structuredContent:{data}});
const annotations={readOnlyHint:false,destructiveHint:false,openWorldHint:true,idempotentHint:false};
type Deps={create:()=>Promise<any>;authenticate:(handle:string)=>Promise<any>;consume:(session:any,kind:'uploads'|'quotes')=>Promise<any>;studio:any;origin:string;download?:(url:string)=>Promise<Uint8Array>};
let receiving=false;const boot=Date.now();
export function nativeMcp(deps:Deps){const {studio}=deps;
 async function owned(h:string){const s=await deps.authenticate(h);if(!s)throw Error('Request handle expired or invalid');return s}
 return createMcpHandler(()=>{const server=new McpServer({name:'Media Studio file input',version:'0.1.0'});
 server.registerTool('prepare_video',{
 title:'Prepare attached media workflow',description:'Import a user-authorized ChatGPT attachment and quote its ordered media workflow. No payment or processing is started. Returns private requestHandle and inputId; call get_video_input until ready. Keep both internally. Use PayBox use_service only after ready to purchase the returned URL/body; never put requestHandle in payment arguments. Default English transcription. File must include actual host-supplied download_url and file_id, not an invented URL.',inputSchema:z.object({file,steps:steps.optional()}).strict(),_meta:{'openai/fileParams':['file']},annotations,
 },async ({file,steps})=>{if(receiving)throw Error('One attachment import at a time; retry after current input finishes');receiving=true;let session:any;try{session=await deps.create();const inputId=randomUUID();const state:any={id:inputId,owner:session.requestId,status:'downloading',createdAt:new Date().toISOString(),expiresAt:session.expiresAt};await studio.save('native-inputs',inputId,state);
 void (async()=>{try{const s=await owned(session.requestHandle);await deps.consume(s,'uploads');const bytes=await (deps.download||attachmentBytes)(file.download_url);const asset=await studio.upload(bytes,s.owner);state.assetId=asset.id;await deps.consume(await owned(session.requestHandle),'quotes');const quote=await studio.quote({assetId:asset.id,steps:steps||[{type:'transcribe',language:'en'}]},s.owner,'paid');state.quote=quote;state.status='ready';state.purchase={url:deps.origin+'/purchases/'+quote.id,method:'POST',body:{idempotencyKey:'native-'+inputId}};}catch{state.status='failed';state.error='Attachment import or workflow validation failed. Check file authorization/expiry, host, media limits and installed capabilities; no payment attempted. Start a new input with a fresh reference.'}finally{await studio.save('native-inputs',inputId,state);receiving=false}})();
 return result({inputId,requestHandle:session.requestHandle,status:'downloading',next:'Poll get_video_input; retain the handle privately. No payment attempted.'});
 }catch(e){receiving=false;throw e}});
 server.registerTool('get_video_input',{title:'Read attached media preparation',description:'Poll an owned attachment import. On ready, quote.amountAtomic and quote.expiresAt are authoritative. Send purchase.url/method/body to PayBox use_service with the real wallet credential. Handle is only for private data access.',inputSchema:z.object({inputId:id,requestHandle:handle}).strict(),annotations:{...annotations,readOnlyHint:true,idempotentHint:true}},async ({inputId,requestHandle})=>{const s=await owned(requestHandle);const r=await studio.read('native-inputs',inputId);if(r.owner!==s.owner)throw Error('Input not found');if(r.status==='downloading'&&Date.parse(r.createdAt)<boot){r.status='failed';r.error='Import interrupted by server restart; no payment attempted'}const {owner,...data}=r;return result(data)});
 server.registerTool('get_media_purchase',{title:'Read paid media fulfillment',description:'Read owned quote payment/job status after PayBox completes. Never pays. Poll PayBox request separately first.',inputSchema:z.object({quoteId:id,requestHandle:handle}).strict(),annotations:{...annotations,idempotentHint:true}},async ({quoteId,requestHandle})=>result(await api('/quotes/'+quoteId,requestHandle)));
 server.registerTool('get_media_job',{title:'Read media job',description:'Poll owned processing job and artifact paths. No payment.',inputSchema:z.object({jobId:id,requestHandle:handle}).strict(),annotations:{...annotations,readOnlyHint:true,idempotentHint:true}},async ({jobId,requestHandle})=>result(await api('/jobs/'+jobId,requestHandle)));
 server.registerTool('read_media_artifact',{title:'Read a small media artifact',description:'Read owned SRT/VTT/JSON artifact as base64, maximum 48 KiB. Larger outputs use authenticated API download. No payment.',inputSchema:z.object({jobId:id,name:z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),requestHandle:handle}).strict(),annotations:{...annotations,readOnlyHint:true,idempotentHint:true}},async ({jobId,name,requestHandle})=>result(await api('/jobs/'+jobId+'/artifacts/'+name+'?inline=base64',requestHandle)));
 return server;});
 async function api(path:string,h:string){await owned(h);const r=await fetch('http://127.0.0.1:'+String(process.env.PORT||8787)+path,{headers:{'X-Request-Handle':h}});if(!r.ok)throw Error('Media API returned '+r.status);return r.json()}
}
