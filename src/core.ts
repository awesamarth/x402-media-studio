import {captionDocument,type CaptionSource} from './source-captions';
import {validateRemoteUrl} from './import-proxy';
import {validateUploadSize} from './limits';
import {command} from './process';
export {command} from './process';
import {runWorkflow} from './pipeline';
import {localAI,localTranslation} from './local-ai';
import {repairSubtitles,type SubtitleOptions} from './subtitles';
import { stat, unlink, rm, mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export type Step = { type: string; start?: number; duration?: number; targetBytes?: number; text?: string; options?: SubtitleOptions; ocr?: boolean; atSeconds?: number[]; language?: string; from?: string; to?: string };
export type Workflow = {assetId:string; steps:Step[];source?:{url:string;media:'audio'|'video'}};
const real = ['clip','frames','repair_subtitles','convert','normalize','transcribe','localize'];
export function validate(w:Workflow) {
 if(w&&Object.keys(w).some(k=>!['assetId','steps','source'].includes(k)))throw Error('Workflow accepts an uploaded asset or URL source, and ordered steps');
 if(w?.source){if(Object.keys(w.source).some(k=>!['url','media'].includes(k))||typeof w.source.url!=='string'||w.source.url.length>2048||!['audio','video'].includes(w.source.media)||w.assetId!=='0'.repeat(64))throw Error('Use one source URL/media or one uploaded asset');validateRemoteUrl(w.source.url)}
 if(!w||!/^[a-f0-9]{64}$/.test(w.assetId)||!Array.isArray(w.steps)||!w.steps.length||w.steps.length>8)throw Error('Provide an assetId and 1–8 steps');
 let captions=false;
 for(const s of w.steps){
  if(!s||!real.includes(s.type))throw Error('Unsupported workflow step');
  if(s.type==='clip'&&(!(Number.isFinite(s.start)&&s.start!>=0)||!(Number.isFinite(s.duration)&&s.duration!>0&&s.duration!<=600)))throw Error('clip requires start >= 0 and duration 0–600 seconds');
  if(s.type==='convert'&&!(Number.isInteger(s.targetBytes)&&s.targetBytes!>=100000&&s.targetBytes!<=100000000))throw Error('convert targetBytes must be 100000–100000000');
  if(s.ocr!==undefined&&typeof s.ocr!=='boolean')throw Error('ocr must be boolean');
  if(s.type==='frames'&&s.atSeconds!==undefined&&(!Array.isArray(s.atSeconds)||!s.atSeconds.length||s.atSeconds.length>12||s.atSeconds.some(t=>!Number.isFinite(t)||t<0)))throw Error('frames atSeconds requires 1–12 finite nonnegative sample times');
  if(s.type==='clip'||s.type==='normalize')captions=false;
  if(s.type==='transcribe'){if(s.language!==undefined&&!['en','auto'].includes(s.language))throw Error('Transcription supports en or auto; English verified');captions=true}
  if(s.type==='repair_subtitles'||s.type==='localize'){
   if(s.text!==undefined&&(typeof s.text!=='string'||s.text.length>100000))throw Error('Subtitle text must be at most 100000 characters');
   if(s.text===undefined&&!captions)throw Error(`${s.type} requires text or preceding captions`);
   const planned=repairSubtitles(s.text??'1\n00:00:00,000 --> 00:00:01,000\nValidate options',s.options);if(s.type==='localize'&&(planned.cueCount>500||planned.cues.some(c=>c.text.length>2000)))throw Error('Translation supports at most 500 cues of 2000 characters each');
   if(s.type==='localize'&&((s.from||'en')!=='en'||(s.to||'es')!=='es'))throw Error('Local translation currently supports en → es only');
   captions=true;
  }
 }
}
function validateAssetSteps(w:Workflow,asset:any){if(asset.kind==='captions'&&(w.steps[0]?.type!=='transcribe'||w.steps.some(s=>!['transcribe','localize','repair_subtitles'].includes(s.type))))throw Error('Caption assets support transcription output, translation and subtitle repair only');let duration=asset.duration;const audio=asset.streams.some((v:any)=>v.type==='audio'),video=asset.streams.some((v:any)=>v.type==='video');for(const step of w.steps){if(['transcribe','normalize'].includes(step.type)&&!audio&&asset.kind!=='captions')throw Error(`${step.type} requires an audio stream`);if(step.type==='transcribe'&&asset.kind!=='captions'&&duration>300)throw Error('Local transcription is limited to five minutes; clip first');if(step.type==='frames'&&(!video||(step.atSeconds||[0]).some(t=>t>=duration)))throw Error('frames requires video and sample times inside its duration');if(step.type==='clip'){if(step.start!+step.duration!>duration+0.05)throw Error('Clip range exceeds media duration');duration=step.duration!}}}
export class Studio {
 running=false;
 uploading=false;
 async storageBytes(dir=this.root):Promise<number>{let bytes=0;for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);bytes+=entry.isDirectory()?await this.storageBytes(p):(await stat(p)).size}return bytes}
 async checkStorage(){if(await this.storageBytes()>256*1024*1024)throw Error('Local storage quota reached (256 MiB); operator cleanup required')}
 enqueueTail:Promise<unknown>=Promise.resolve();
 constructor(public root=process.env.DATA_DIR||'data'){}
 path(...p:string[]){return join(this.root,...p)}
 async init(){for(const d of ['assets','jobs','quotes','payments','receipts','assetAccess']) await mkdir(this.path(d),{recursive:true});
 for(const f of (await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'))){const j=await this.read('jobs',f.slice(0,-5));if(j.status==='running'||j.status==='queued'&&j.attempts>=2){j.status=j.attempts>=2?'failed':'queued';if(j.status==='failed')j.error='Retry budget exhausted during restart';await this.save('jobs',j.id,j)}} void this.drain();}
 async save(kind:string,id:string,value:unknown){const p=this.path(kind,id+'.json');const temp=p+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2));await rename(temp,p)}
 async read(kind:string,id:string){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw Error('Invalid identifier');return JSON.parse(await readFile(this.path(kind,id+'.json'),'utf8'))}
 async upload(bytes:Uint8Array,owner='local-core'){if(this.uploading)throw Error('One upload/probe at a time; retry later');this.uploading=true;try{await this.checkStorage();const asset=await this.uploadOnce(bytes);await this.save('assetAccess',createHash('sha256').update(owner+':'+asset.id).digest('hex'),{owner,assetId:asset.id});return asset}finally{this.uploading=false}}
 async uploadOnce(bytes:Uint8Array){validateUploadSize(bytes.length);const id=createHash('sha256').update(bytes).digest('hex');await writeFile(this.path('assets',id),bytes);try{const info=JSON.parse(await command(['ffprobe','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,mp3,wav,ogg,flac,aac,image2','-v','quiet','-show_format','-show_streams','-of','json',this.path('assets',id)]));const result={id,bytes:bytes.length,duration:Number(info.format.duration),streams:info.streams.map((s:any)=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height}))};if(!Number.isFinite(result.duration)||result.duration<=0||result.duration>1800||info.streams.length>8||info.streams.some((s:any)=>(s.width||0)*(s.height||0)>3840*2160))throw Error('Duration limit: 30 minutes');await this.save('assets',id,result);return result}catch{await unlink(this.path('assets',id)).catch(()=>{});throw Error('Asset must be valid media, at most 30 minutes, 4K and 8 streams')}}
 async uploadCaptions(text:string,provenance:CaptionSource,owner:string){await this.checkStorage();const document=captionDocument(text,provenance);const bytes=Buffer.from(JSON.stringify(document));const id=createHash('sha256').update(bytes).digest('hex');await writeFile(this.path('assets',id),bytes);const asset={id,kind:'captions',bytes:bytes.length,duration:document.duration,streams:[],language:provenance.language,provenance};await this.save('assets',id,asset);await this.save('assetAccess',createHash('sha256').update(owner+':'+id).digest('hex'),{owner,assetId:id});return asset}
 async asset(id:string,owner:string){const grant=await this.read('assetAccess',createHash('sha256').update(owner+':'+id).digest('hex'));if(grant.owner!==owner||grant.assetId!==id)throw Error('Asset not found');return this.read('assets',id)}
 async quote(w:Workflow,owner='local-core',mode:'free'|'paid'='free'){validate(w);if(w.source&&process.platform==='linux'&&process.env.URL_IMPORTS_ENABLED!=='1')throw Object.assign(Error('Server URL retrieval is not configured; upload media or captions directly. No execution or payment started.'),{status:503});await this.checkStorage();if((await readdir(this.path('quotes'))).filter(f=>f.endsWith('.json')).length>=256)throw Error('Quote count limit reached; operator cleanup required');const asset=w.source?{kind:'remote',duration:0,streams:[]} :await this.asset(w.assetId,owner);for(const step of w.steps){if(step.type==='transcribe'&&asset.kind!=='captions')await localAI('transcribe');if(step.type==='frames'&&step.ocr)await localAI('ocr');if(step.type==='localize')await localTranslation()}if(!w.source)validateAssetSteps(w,asset);const q={id:randomUUID(),owner,mode,workflow:w,amountAtomic:mode==='free'?'0':String((w.steps.length+(w.source?1:0))*10000),paymentConfigured:false,chain:'eip155:8453',expiresAt:new Date(Date.now()+240000).toISOString()};await this.save('quotes',q.id,q);return q}
 async assertAdmission(){await this.checkStorage();if((await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json')).length>=512)throw Error('Job count limit reached; operator cleanup required');let queued=0;for(const file of (await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'))){if(['queued','running'].includes((await this.read('jobs',file.slice(0,-5))).status))queued++}if(queued>=8)throw Error('Queue is full; retry existing purchase later');}
 enqueue(quoteId:string,key:string,settled=false){const next=this.enqueueTail.then(()=>this.enqueueOnce(quoteId,key,settled));this.enqueueTail=next.catch(()=>{});return next}
 async enqueueOnce(quoteId:string,key:string,settled=false){if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw Error('Use an 8–100 character idempotency key');const id=createHash('sha256').update(key).digest('hex');try{const prior=await this.read('jobs',id);if(prior.quoteId!==quoteId)throw Error('Idempotency key already used for another quote');return prior}catch(e:any){if(e.code!=='ENOENT')throw e}
 await this.assertAdmission();const q=await this.read('quotes',quoteId);if(!settled&&Date.parse(q.expiresAt)<Date.now())throw Error('Quote expired');const j={id,owner:q.owner,quoteId,workflow:q.workflow,status:'queued',attempts:0,artifacts:[]};await this.save('jobs',id,j);void this.drain();return j}
 async drain(){if(this.running)return;this.running=true;try{for(const f of (await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'))){const j=await this.read('jobs',f.slice(0,-5));if(j.status!=='queued')continue;if(j.attempts>=2){j.status='failed';j.error='Retry budget exhausted';await this.save('jobs',j.id,j);continue}while(j.attempts<2){j.status='running';j.attempts++;await this.save('jobs',j.id,j);try{j.artifacts=await this.execute(j.id,j.workflow,j.owner);j.status='succeeded';delete j.error;break}catch(e){j.error=String(e);j.status='failed'}}await this.save('jobs',j.id,j)}}finally{this.running=false;const pending=(await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'));for(const f of pending){if((await this.read('jobs',f.slice(0,-5))).status==='queued'){queueMicrotask(()=>void this.drain());break}}}}
 async execute(id:string,w:Workflow,owner='local-core'){validate(w);await this.checkStorage();if(w.source){const {download}=await import('./imports');const dir=this.path('import-work',id);await mkdir(dir,{recursive:true});try{const result=await download(w.source.url,w.source.media,resolve(dir),w.steps);const asset=result instanceof Uint8Array?await this.upload(result,owner):await this.uploadCaptions(result.captions,result.provenance,owner);validateAssetSteps({assetId:asset.id,steps:w.steps},await this.asset(asset.id,owner));return runWorkflow(this.root,id,{assetId:asset.id,steps:w.steps},()=>this.checkStorage())}finally{await rm(dir,{recursive:true,force:true})}}return runWorkflow(this.root,id,w,()=>this.checkStorage())}
}
