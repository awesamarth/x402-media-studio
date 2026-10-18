import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {download,importRequest} from '../src/imports';

// Real isolated downloader probe. No quote, payment, or job is created.
const [url,mode='captions']=process.argv.slice(2);
if(!url || !['captions','video'].includes(mode)) throw Error('Usage: bun scripts/test-home-import.ts <public YouTube URL> [captions|video]');
if(!process.env.IMPORT_YOUTUBE_PROXY_URL) throw Error('Set IMPORT_YOUTUBE_PROXY_URL to the private SSH loopback forward first');
const request=importRequest({url,media:mode==='video'?'video':'audio',idempotencyKey:'home-proxy-probe'});
const dir=await mkdtemp(join(resolve(process.env.DATA_DIR||'data'),'home-proxy-probe-'));
const started=Date.now();
try {
  const result=await download(request.url,request.media,dir,request.steps!);
  console.log(JSON.stringify(result instanceof Uint8Array
    ? {ok:true,kind:'media',bytes:result.length,elapsedMs:Date.now()-started}
    : {ok:true,kind:'source-captions',characters:result.captions.length,provenance:result.provenance,elapsedMs:Date.now()-started},null,2));
} finally {await rm(dir,{recursive:true,force:true});}
