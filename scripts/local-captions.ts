import {spawn} from 'node:child_process';
import {mkdtemp,readdir,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {validateRemoteUrl} from '../src/import-proxy';
import {selectCaptions,captionDocument,type CaptionSource} from '../src/source-captions';
/** Trusted interactive CLI only. Never used by the server's remote URL endpoint. */
export async function localCaptions(url:string,language='en'){
 validateRemoteUrl(url);const dir=await mkdtemp(join(tmpdir(),'media-local-captions-'));
 try{
  const binary=process.env.YT_DLP_BIN||Bun.which('yt-dlp');if(!binary)throw Error('Install yt-dlp for the local URL helper');
  console.log('Fetching captions with installed yt-dlp (no video download)…');
  const run=async(extra:string[])=>await new Promise<void>((done,fail)=>{
   const child=spawn(binary,['--ignore-config','--skip-download',...extra,'--paths',dir,'-o','source.%(ext)s','--',url],{detached:true,cwd:dir,env:{PATH:process.env.PATH,HOME:dir,TMPDIR:dir,LANG:process.env.LANG||'en_US.UTF-8'},stdio:['ignore','pipe','pipe']});
   let settled=false,outputBytes=0,error='';const stop=()=>{try{process.kill(-child.pid!,'SIGKILL')}catch{}};
   const cancel=()=>{stop();finish(Error('Caption retrieval interrupted'))};
   const finish=(e?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(monitor);process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);e?fail(e):done()};
   process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
   const timer=setTimeout(()=>{stop();finish(Error('Local caption retrieval timed out'))},120000);
   const monitor=setInterval(()=>{void readdir(dir).then(async files=>{let size=0;for(const f of files){const s=await stat(join(dir,f));if(s.isFile())size+=s.size}if(size>16*1024*1024){stop();finish(Error('Caption download exceeded its 16 MiB temporary-file budget'))}}).catch(()=>{})},500);
   child.stdout.on('data',b=>{outputBytes+=b.length;if(outputBytes>2*1024*1024){stop();finish(Error('Downloader console output exceeded its limit'))}});
   child.stderr.on('data',b=>{error=(error+b.toString()).slice(-2048)});
   child.on('error',()=>finish(Error('Installed yt-dlp could not start')));
   child.on('close',code=>finish(code===0?undefined:Error('yt-dlp caption retrieval failed: '+error.replace(/https?:\/\/\S+/g,'[URL]').replace(/[^\x20-\x7e]/g,' ').slice(-1000))));
  });
  await run(['--write-info-json']);
  const infoPath=join(dir,'source.info.json');if((await stat(infoPath)).size>12*1024*1024)throw Error('Caption metadata exceeds 12 MiB');const info=JSON.parse(await readFile(infoPath,'utf8'));
  if(info.is_live||info.is_upcoming||info.has_drm||info.availability&&!['public','unlisted'].includes(info.availability))throw Error('Source is restricted or live; no fallback');
  const selected=selectCaptions(info,language==='auto'?'en':language);if(!selected)return;
  await run([selected.kind==='manual'?'--write-subs':'--write-auto-subs','--sub-langs','^'+selected.trackLanguage+'$','--sub-format',selected.format]);
  const path=join(dir,`source.${selected.trackLanguage}.${selected.format}`);if((await stat(path)).size>2*1024*1024)throw Error('Caption file exceeds 2 MiB');const text=await readFile(path,'utf8');
  const provenance:CaptionSource={kind:selected.kind,language:selected.language,trackLanguage:selected.trackLanguage,pageUrl:url,extractor:String(info.extractor_key||info.extractor||'unknown')};captionDocument(text,provenance);
  console.log('Retrieved '+selected.kind+' captions ('+selected.trackLanguage+'); media download skipped.');return {text,provenance};
 }finally{await rm(dir,{recursive:true,force:true})}
}
