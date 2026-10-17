import {validateUploadSize} from '../src/limits';
import {spawn,type ChildProcess} from 'node:child_process';
import {Readable} from 'node:stream';
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const project=resolve(import.meta.dir,'..');
async function freePort(){for(let attempt=0;attempt<50;attempt++){const port=randomInt(7000,8000);const available=await new Promise<boolean>((done)=>{const probe=createServer();probe.once('error',()=>done(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>done(true)))});if(available)return port}throw Error('No available loopback 7xxx port found')}
function argumentsForRun(){const args=Bun.argv.slice(2);if(args[0]==='--')args.shift();if(!args.length||args.includes('--help')){console.log('Usage: bun run try:file -- /absolute/path/to/media.mp4 [--language en|auto]\nUses real HTTP upload → quote → free job → poll → SRT/VTT/JSON download.\nLimits: 100 MiB, 5 minutes, audio stream required. English verified.\nStarts a temporary loopback server on an available 7xxx port and stops it afterward.\nOutputs: outputs/try-file/<run>/; original file is never changed.');return}const file=resolve(args.shift()!);let language='en';while(args.length){const option=args.shift();if(option!=='--language'||!args.length)throw Error('Unknown option; use --help');language=args.shift()!}if(!['en','auto'].includes(language))throw Error('--language must be en or auto');return {file,language}}
async function main(){
 const options=argumentsForRun();if(!options)return;
 const input=await stat(options.file).catch(()=>{throw Error('Input file not found; pass its absolute path')});if(!input.isFile())throw Error('Input must be a regular media file');validateUploadSize(input.size);
 const token=randomBytes(32).toString('hex'); // Process-local test authentication. Never saved or printed.
 const root=await mkdtemp(join(tmpdir(),'media-try-file-'));
 const out=join(project,'outputs','try-file',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 let child:ChildProcess|undefined;let childClosed:Promise<void>|undefined;let closed=false;let childStderr='';
 const stop=()=>{if(child?.pid&&!closed)try{process.kill(-child.pid,'SIGKILL')}catch{}};
 const interrupt=()=>{stop();process.exitCode=130};
 process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 try{
  const port=await freePort();const base=`http://127.0.0.1:${port}`;
  const running=spawn(process.execPath,['src/server.ts'],{cwd:project,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:root,API_ACCOUNTS_JSON:'',LOCAL_DEV_TOKEN:token,BILLING_MODE:'free',MEDIA_TEST_READY:'1'},detached:true,stdio:['ignore','pipe','pipe']});
  child=running;childClosed=new Promise<void>((done)=>{running.once('close',()=>{closed=true;done()})});const drainErrors=(async()=>{const reader=Readable.toWeb(running.stderr!).getReader();while(true){const r=await reader.read();if(r.done)return;childStderr=(childStderr+new TextDecoder().decode(r.value)).slice(-8192)}})();
  const ready=async()=>{const reader=Readable.toWeb(running.stdout!).getReader();let buffer='';try{while(true){const r=await reader.read();if(r.done)throw Error('Temporary server failed to start');buffer+=new TextDecoder().decode(r.value);if(buffer.length>8192)throw Error('Unexpected server startup response');if(buffer.includes('\n')){const signal=JSON.parse(buffer.split('\n')[0]!);if(signal.event!=='media-ready'||signal.port!==port||signal.mode!=='free')throw Error('Temporary server did not confirm free mode');return}}}finally{reader.releaseLock()}};
  let startupTimer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([ready(),new Promise<never>((_,reject)=>{startupTimer=setTimeout(()=>reject(Error('Temporary server startup timed out')),10000)})])}finally{clearTimeout(startupTimer)}
  console.log(`Temporary FREE API: ${base}`);
  const api=async(path:string,body?:unknown)=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(150000)});const result=await response.json();if(!response.ok)throw Error(`${path}: HTTP ${response.status}: ${String(result.error||'request failed')}`);return result};
  console.log('Uploading raw file bytes…');const response=await fetch(base+'/assets',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/octet-stream'},body:Bun.file(options.file),signal:AbortSignal.timeout(150000)});const asset=await response.json();if(!response.ok)throw Error(`Upload failed: ${String(asset.error||response.status)}`);
  const quote=await api('/quotes',{assetId:asset.id,steps:[{type:'transcribe',language:options.language}]});if(quote.mode!=='free')throw Error('Refusing non-free quote');
  const purchase=await api('/workflows',{quoteId:quote.id,idempotencyKey:'try-file-'+randomUUID()});if(purchase.mode!=='free'||purchase.paymentStatus!=='not_required')throw Error('Expected free execution acknowledgment');
  const ownedPurchase=await api('/quotes/'+quote.id);if(!ownedPurchase.jobId)throw Error('No job ID returned for free workflow');const jobId=ownedPurchase.jobId;
  console.log(`Transcribing ${Number(asset.duration).toFixed(1)}s of media (${options.language})…`);
  let job:any;const deadline=Date.now()+300000;let previous='';while(Date.now()<deadline){job=await api('/jobs/'+jobId);if(job.status!==previous){console.log(`Job: ${job.status}`);previous=job.status}if(job.status==='succeeded')break;if(job.status==='failed')throw Error(`Transcription failed: ${job.error||'unknown worker error'}`);await Bun.sleep(250)}if(job?.status!=='succeeded')throw Error('Transcription timed out; try a shorter file');
  await mkdir(out,{recursive:true});const paths:Record<string,string>={};for(const [artifact,name] of [['0.transcript.srt','transcript.srt'],['0.transcript.vtt','transcript.vtt'],['0.transcript.json','transcript.json']]){if(!job.artifacts.some((a:any)=>a.name===artifact))throw Error('Expected transcript artifact missing');const download=await fetch(`${base}/jobs/${jobId}/artifacts/${artifact}`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});if(!download.ok)throw Error(`Artifact download failed: ${download.status}`);const path=join(out,name!);await Bun.write(path,download);paths[name!]=path}
  const transcript=await Bun.file(paths['transcript.json']!).json();await writeFile(join(out,'run.json'),JSON.stringify({mode:'free',input:options.file,assetId:asset.id,jobId,language:transcript.language,outputs:paths},null,2));
  console.log('Done. No payment was requested.');for(const [name,path] of Object.entries(paths))console.log(`${name}: ${path}`);
 }catch(error){const message=String(error instanceof Error?error.message:error).replaceAll(token,'[redacted]');throw Error(message+(child?.exitCode!==null&&childStderr?' (temporary server exited; check local model setup)':''))}
 finally{stop();if(childClosed)await childClosed;process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await rm(root,{recursive:true,force:true});console.log('Temporary API stopped; uploaded working copy removed. Your input and downloaded results are unchanged.')}
}
if(import.meta.main){try{await main()}catch(error){console.error(`try:file: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}}
