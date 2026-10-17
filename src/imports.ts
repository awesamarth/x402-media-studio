import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readdir,rm,stat,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Studio,validate,type Step} from './core';
import {startImportProxy,validateRemoteUrl} from './import-proxy';
import {MAX_UPLOAD_BYTES} from './limits';
import {command} from './process';
import {tmpdir} from 'node:os';
import {selectCaptions,type CaptionSource} from './source-captions';
import {linuxImportCommand} from './import-runner';

type Request={url:string;media:'audio'|'video';idempotencyKey:string;steps?:Step[]};
export function importRequest(value:any):Request {
 if(!value||Object.keys(value).some(k=>!['url','media','idempotencyKey','steps'].includes(k))||typeof value.url!=='string'||value.url.length>2048||!['audio','video'].includes(value.media)||!/^[-a-zA-Z0-9_]{8,100}$/.test(value.idempotencyKey))throw Error('Provide url, media (audio or video), idempotencyKey (8–100 characters), and optional steps');
 validateRemoteUrl(value.url);
 const steps=value.steps??(value.media==='audio'?[{type:'transcribe',language:'en'}]:[{type:'frames',atSeconds:[0]}]);
 validate({assetId:'0'.repeat(64),steps});
 return {...value,steps};
}
/** Every downloader subprocess is restricted to the enforcing local CONNECT proxy. */
export async function download(url:string,media:'audio'|'video',dir:string,steps:Step[]) {
 if(!['darwin','linux'].includes(process.platform))throw Error('Unsupported import runner platform');
 const linux=process.platform==='linux'||process.env.IMPORT_RUNNER==='docker';
 const proxyDir=linux?await mkdtemp(join(tmpdir(),'media-proxy-')):undefined;
 const proxy=await startImportProxy(proxyDir?{socketPath:join(proxyDir,'proxy.sock')}:{});
 const remoteDir=linux?'/work':dir;
 const policy=`(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote tcp "localhost:${proxy.port}"))`;
 const common=['--ignore-config','--no-playlist','--socket-timeout','20','--retries','0','--fragment-retries','0','--extractor-retries','0','--concurrent-fragments','1','--proxy',`http://127.0.0.1:${linux?7777:proxy.port}`,'--max-filesize',String(MAX_UPLOAD_BYTES),'--limit-rate','2M','--no-progress','--restrict-filenames','--paths',remoteDir,'--paths',`temp:${remoteDir}`,'-o','source.%(ext)s'];
 async function run(args:string[]) {
  return await new Promise<string>((ok,fail)=>{
   const container=linux?linuxImportCommand(dir,proxyDir!,[...common,...args,'--',url]):undefined;
   const child=spawn(container?.binary||'/usr/bin/sandbox-exec',container?.args||['-p',policy,process.env.YT_DLP_BIN||'/usr/local/bin/yt-dlp',...common,...args,'--',url],{cwd:dir,detached:true,env:{PATH:process.env.PATH,HOME:dir,TMPDIR:dir,LANG:'en_US.UTF-8'},stdio:['ignore','pipe','pipe']});
   let output='',size=0,done=false;let accessDenied=false;let diagnosticTail='';let safeDiagnostic='';
   const stop=()=>{if(container){const cleanup=spawn(container.binary,['rm','-f',container.name],{stdio:'ignore'});cleanup.on('error',()=>{});}try{process.kill(-child.pid!,'SIGKILL')}catch{}};
   const timer=setTimeout(()=>{stop();finish(Error('Import exceeded its three minute deadline'))},180000);
   const monitor=setInterval(()=>{void readdir(dir).then(async files=>{let bytes=0;for(const file of files){const s=await stat(join(dir,file));if(s.isFile())bytes+=s.size}if(bytes>MAX_UPLOAD_BYTES){stop();finish(Error('Import exceeded 100 MiB'))}}).catch(()=>{})},500);
   function finish(error?:Error){if(done)return;done=true;clearTimeout(timer);clearInterval(monitor);error?fail(error):ok(output)}
   child.stdout.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){stop();finish(Error('Extractor response exceeded its limit'))}else output+=chunk.toString()});
   child.stderr.on('data',chunk=>{diagnosticTail=(diagnosticTail+chunk.toString()).slice(-2048);safeDiagnostic=diagnosticTail.split('\n').filter((line:string)=>/ERROR:|WARNING:/i.test(line)).slice(-3).join(' ').replace(/https?:\/\/\S+/g,'[URL]').replace(/[^\x20-\x7e]/g,'').slice(0,1000);if(/sign.?in|log.?in|cookies|not a bot|private video|HTTP Error (403|429)|geo.?restrict|video (?:is unavailable|is not available|isn't available|has been removed)|not available in your country|copyright|blocked/i.test(diagnosticTail))accessDenied=true}); // Provider responses may contain signed URLs: never persist them.
   child.on('error',()=>finish(Error('Downloader could not start; install yt-dlp and FFmpeg')));
   child.on('close',code=>{const reason=accessDenied?'Source denied access or requires authentication; caption lookup did not establish absence, so no media fallback was attempted':'Downloader rejected or could not retrieve this public URL; authenticated, restricted and unsupported sources are not bypassed';finish(code===0&&!accessDenied?undefined:Error(reason+(safeDiagnostic?'; '+safeDiagnostic:'')+'; denied proxy hosts: '+(proxy.diagnostics().deniedHosts.join(', ')||'none')))});
  });
 }
 try {
  const captionsOnly=steps[0]?.type==='transcribe'&&steps.every(s=>['transcribe','localize','repair_subtitles'].includes(s.type));
  await run(['--skip-download','--write-info-json',...(captionsOnly?['--ignore-no-formats-error']:[])]);
  const metadataPath=join(dir,'source.info.json');if((await stat(metadataPath)).size>12*1024*1024)throw Error('Extractor metadata exceeds 12 MiB');const metadata=JSON.parse(await readFile(metadataPath,'utf8'));await rm(metadataPath);
  if(metadata.has_drm||(metadata.availability&&!['public','unlisted'].includes(metadata.availability)))throw Error('Source is restricted or requires authentication; no caption/media fallback');
  if(metadata._type==='playlist'||metadata.entries||metadata.is_live||metadata.is_upcoming||(metadata.live_status&&metadata.live_status!=='not_live'))throw Error('Playlists, live and upcoming streams are not supported');
  if(captionsOnly){const selected=selectCaptions(metadata,steps[0]?.language||'en');if(selected){
   await run(['--skip-download','--ignore-no-formats-error',selected.kind==='manual'?'--write-subs':'--write-auto-subs','--sub-langs','^'+selected.trackLanguage+'$','--sub-format',selected.format]);
   const files=(await readdir(dir)).filter(f=>f===`source.${selected.trackLanguage}.${selected.format}`);if(files.length!==1)throw Error('Selected caption track could not be retrieved; no media fallback after caption download errors');
   const file=join(dir,files[0]!);if((await stat(file)).size>2*1024*1024)throw Error('Caption file exceeds 2 MiB');
   const provenance:CaptionSource={kind:selected.kind,language:selected.language,trackLanguage:selected.trackLanguage,pageUrl:url,extractor:String(metadata.extractor_key||metadata.extractor||'unknown')};
   return {captions:await readFile(file,'utf8'),provenance};
  }}
  if(metadata.duration!=null&&(!Number.isFinite(metadata.duration)||metadata.duration<=0||metadata.duration>(media==='audio'?300:600)))throw Error('Import allows at most five minutes audio or ten minutes video');
  await run(media==='audio'?['-f','ba[protocol=https]/b[protocol=https]','-x','--audio-format','wav']:['-f','b[height<=?720][protocol=https]','-t','mp4']);
  const files=(await readdir(dir)).filter(f=>/^source\.(wav|mp4)$/.test(f));
  if(files.length!==1)throw Error('Downloader did not produce one supported media file');
  const file=join(dir,files[0]!);const info=await stat(file);if(info.size>MAX_UPLOAD_BYTES)throw Error('Import exceeded 100 MiB');
  const probe=JSON.parse(await command(['ffprobe','-protocol_whitelist','file,pipe','-v','quiet','-show_format','-of','json',file],{timeoutMs:10000}));
  const duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>(media==='audio'?300:600))throw Error('Downloaded media duration is invalid or exceeds the import limit');
  return new Uint8Array(await readFile(file));
 }finally{await proxy.close();if(proxyDir)await rm(proxyDir,{recursive:true,force:true})}
}
export class Imports {
 private running=false;private tail:Promise<unknown>=Promise.resolve();
 constructor(private studio:Studio){}
 async init(){await mkdir(this.studio.path('imports'),{recursive:true});await mkdir(this.studio.path('import-work'),{recursive:true});for(const f of await readdir(this.studio.path('imports'))){if(!f.endsWith('.json'))continue;const r=await this.studio.read('imports',f.slice(0,-5));if(r.status==='downloading'){r.status='failed';r.error='Download interrupted by restart; submit a new key to retry';await this.studio.save('imports',r.id,r);await rm(this.studio.path('import-work',r.id),{recursive:true,force:true})}}void this.drain()}
 async get(id:string,owner:string){const r=await this.studio.read('imports',id);if(r.owner!==owner)throw Object.assign(Error('Import not found'),{code:'ENOENT'});if(r.jobId){const j=await this.studio.read('jobs',r.jobId);r.status=j.status==='succeeded'?'succeeded':j.status==='failed'?'failed':'processing';if(j.error)r.error=j.error}const {request,fingerprint,...publicRecord}=r;return publicRecord}
 enqueue(value:unknown,owner:string){const task=this.tail.then(()=>this.enqueueOnce(value,owner));this.tail=task.catch(()=>{});return task}
 private async enqueueOnce(value:unknown,owner:string){const request=importRequest(value);if(!['darwin','linux'].includes(process.platform))throw Error('URL import requires macOS or the Linux container runner');const id=createHash('sha256').update(owner+':'+request.idempotencyKey).digest('hex');const fingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');try{const old=await this.studio.read('imports',id);if(old.fingerprint!==fingerprint)throw Error('Idempotency key already used for different import parameters');return this.get(id,owner)}catch(e:any){if(e.code!=='ENOENT')throw e}
 await this.studio.checkStorage();const records=(await readdir(this.studio.path('imports'))).filter(f=>f.endsWith('.json'));if(records.length>=64)throw Error('Import record limit reached; operator cleanup required');let pending=0;for(const f of records){if(['queued','downloading'].includes((await this.studio.read('imports',f.slice(0,-5))).status))pending++}if(pending>=4)throw Error('Import queue is full');await this.studio.save('imports',id,{id,owner,request,fingerprint,status:'queued',createdAt:new Date().toISOString()});void this.drain();return this.get(id,owner)}
 private async drain(){if(this.running)return;this.running=true;try{for(const f of await readdir(this.studio.path('imports'))){if(!f.endsWith('.json'))continue;const r=await this.studio.read('imports',f.slice(0,-5));if(r.status!=='queued')continue;const dir=resolve(this.studio.path('import-work',r.id));try{r.status='downloading';await this.studio.save('imports',r.id,r);await mkdir(dir,{recursive:true});const result=await download(r.request.url,r.request.media,dir,r.request.steps);const asset=result instanceof Uint8Array?await this.studio.upload(result,r.owner):await this.studio.uploadCaptions(result.captions,result.provenance,r.owner);r.provenance=result instanceof Uint8Array?{kind:'generated_or_media',captionLookup:'no_matching_captions_or_media_operations'}:result.provenance;r.assetId=asset.id;const quote=await this.studio.quote({assetId:asset.id,steps:r.request.steps},r.owner,'free');r.quoteId=quote.id;const job=await this.studio.enqueue(quote.id,'import_'+r.id);r.jobId=job.id;r.status='processing'}catch(e:any){r.status='failed';r.error=e.message}finally{await rm(dir,{recursive:true,force:true});await this.studio.save('imports',r.id,r)}}}finally{this.running=false;for(const f of await readdir(this.studio.path('imports'))){if(f.endsWith('.json')&&(await this.studio.read('imports',f.slice(0,-5))).status==='queued'){queueMicrotask(()=>void this.drain());break}}}}
}
