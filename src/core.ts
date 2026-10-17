import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export type Step = { type: string; start?: number; duration?: number; targetBytes?: number; text?: string };
export type Workflow = {assetId:string; steps:Step[]};
const real = ['clip','frames','repair_subtitles','convert','normalize'];
export function validate(w:Workflow) {
 if (!w || !/^[a-f0-9]{64}$/.test(w.assetId) || !Array.isArray(w.steps) || !w.steps.length || w.steps.length>8) throw Error('Provide an assetId and 1–8 steps');
 for(const s of w.steps){
  if(!real.includes(s.type)) throw Error(`${s.type}: dependency unavailable. Transcription requires a configured speech model; localization requires a translation provider; OCR requires an OCR engine. No credentials are loaded.`);
  if(s.type==='clip' && (!(Number.isFinite(s.start)&&s.start!>=0) || !(Number.isFinite(s.duration)&&s.duration!>0&&s.duration!<=600))) throw Error('clip requires start >= 0 and duration 0–600 seconds');
  if(s.type==='convert' && !(Number.isInteger(s.targetBytes)&&s.targetBytes!>=100000&&s.targetBytes!<=100000000)) throw Error('convert targetBytes must be 100000–100000000');
  if(s.type==='repair_subtitles' && (typeof s.text!=='string'||s.text.length>100000)) throw Error('repair_subtitles requires SRT text, at most 100000 characters');
 }
}
export async function command(args:string[]) {
 const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'}); const timeout=setTimeout(()=>p.kill(),120000);
 const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);clearTimeout(timeout);
 if(code!==0) throw Error(`${args[0]} failed: ${err.slice(-1200)}`); return out;
}
export class Studio {
 running=false;
 enqueueTail:Promise<unknown>=Promise.resolve();
 constructor(public root=process.env.DATA_DIR||'data'){}
 path(...p:string[]){return join(this.root,...p)}
 async init(){for(const d of ['assets','jobs','quotes']) await mkdir(this.path(d),{recursive:true});
 for(const f of (await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'))){const j=await this.read('jobs',f.slice(0,-5));if(j.status==='running'){j.status='queued';await this.save('jobs',j.id,j)}} void this.drain();}
 async save(kind:string,id:string,value:unknown){const p=this.path(kind,id+'.json');await writeFile(p+'.tmp',JSON.stringify(value,null,2));await rename(p+'.tmp',p)}
 async read(kind:string,id:string){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw Error('Invalid identifier');return JSON.parse(await readFile(this.path(kind,id+'.json'),'utf8'))}
 async upload(bytes:Uint8Array){if(!bytes.length||bytes.length>50*1024*1024)throw Error('Asset must be 1 byte–50 MiB');const id=createHash('sha256').update(bytes).digest('hex');await writeFile(this.path('assets',id),bytes);try{const info=JSON.parse(await command(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',this.path('assets',id)]));const result={id,bytes:bytes.length,duration:Number(info.format.duration),streams:info.streams.map((s:any)=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height}))};if(!Number.isFinite(result.duration)||result.duration>1800)throw Error('Duration limit: 30 minutes');await this.save('assets',id,result);return result}catch{throw Error('Asset must be valid media, at most 30 minutes')}}
 async quote(w:Workflow){validate(w);await this.read('assets',w.assetId);const q={id:randomUUID(),workflow:w,amountAtomic:String(w.steps.length*10000),paymentConfigured:false,chain:'eip155:8453',expiresAt:new Date(Date.now()+240000).toISOString()};await this.save('quotes',q.id,q);return q}
 enqueue(quoteId:string,key:string){const next=this.enqueueTail.then(()=>this.enqueueOnce(quoteId,key));this.enqueueTail=next.catch(()=>{});return next}
 async enqueueOnce(quoteId:string,key:string){if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw Error('Use an 8–100 character idempotency key');const id=createHash('sha256').update(key).digest('hex');try{const prior=await this.read('jobs',id);if(prior.quoteId!==quoteId)throw Error('Idempotency key already used for another quote');return prior}catch(e:any){if(e.code!=='ENOENT')throw e}
 const q=await this.read('quotes',quoteId);if(Date.parse(q.expiresAt)<Date.now())throw Error('Quote expired');const j={id,quoteId,workflow:q.workflow,status:'queued',attempts:0,artifacts:[]};await this.save('jobs',id,j);void this.drain();return j}
 async drain(){if(this.running)return;this.running=true;try{for(const f of (await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'))){const j=await this.read('jobs',f.slice(0,-5));if(j.status!=='queued')continue;while(j.attempts<2){j.status='running';j.attempts++;await this.save('jobs',j.id,j);try{j.artifacts=await this.execute(j.id,j.workflow);j.status='succeeded';delete j.error;break}catch(e){j.error=String(e);j.status='failed'}}await this.save('jobs',j.id,j)}}finally{this.running=false;const pending=(await readdir(this.path('jobs'))).filter(f=>f.endsWith('.json'));for(const f of pending){if((await this.read('jobs',f.slice(0,-5))).status==='queued'){queueMicrotask(()=>void this.drain());break}}}}
 async execute(id:string,w:Workflow){validate(w);const dir=this.path('jobs',id);await mkdir(dir,{recursive:true});let input=this.path('assets',w.assetId);const artifacts=[];for(const [i,s] of w.steps.entries()){let output=join(dir,`${i}.mp4`);const base=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',input];
 if(s.type==='repair_subtitles'){output=join(dir,`${i}.srt`);const text=s.text!.replace(/\r/g,'').replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g,'$1,$2').trim()+'\n';if(!/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/.test(text))throw Error('Provide SRT timestamps');await writeFile(output,text)}
 else if(s.type==='frames'){output=join(dir,`${i}.jpg`);await command([...base,'-frames:v','1','-vf','scale=640:-2',output]);const manifest={source:w.assetId,frame: `${i}.jpg`,timestampSeconds:0,ocr:{status:'unconfigured'}};await writeFile(join(dir,`${i}.manifest.json`),JSON.stringify(manifest));artifacts.push({name:`${i}.manifest.json`,step:i});}
 else {let args:string[]=[];if(s.type==='clip')args=['-ss',String(s.start),'-t',String(s.duration),'-c:v','libx264','-preset','ultrafast','-c:a','aac'];if(s.type==='normalize')args=['-af','silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_threshold=-45dB,loudnorm','-c:v','copy','-c:a','aac'];if(s.type==='convert'){const info=JSON.parse(await command(['ffprobe','-v','quiet','-show_format','-of','json',input]));const rate=Math.floor(s.targetBytes!*8/Number(info.format.duration)*0.9)-64000;if(rate<32000)throw Error('Target too small for duration');args=['-c:v','libx264','-preset','ultrafast','-b:v',String(rate),'-c:a','aac','-b:a','64000','-fs',String(s.targetBytes)];}await command([...base,...args,'-threads','1',output]);input=output}
 artifacts.push({name:output.split('/').pop()!,step:i});}return artifacts;}
}
