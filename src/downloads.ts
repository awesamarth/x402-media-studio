import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
export function artifactMime(name:string){const ext=name.split('.').pop()?.toLowerCase();return ({mp4:'video/mp4',webm:'video/webm',wav:'audio/wav',mp3:'audio/mpeg',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',srt:'application/x-subrip',vtt:'text/vtt',json:'application/json',txt:'text/plain'} as Record<string,string>)[ext||'']||'application/octet-stream'}
/** Read-only capability for exactly one artifact, bounded by both link and job expiry. */
export class Downloads {
 private key!:Buffer;
 constructor(private root:string,private origin:string){}
 async init(){await mkdir(join(this.root,'retention'),{recursive:true});const file=join(this.root,'retention','download-key');try{this.key=await readFile(file)}catch(e:any){if(e.code!=='ENOENT')throw e;try{await writeFile(file,randomBytes(32),{flag:'wx',mode:0o600})}catch(e:any){if(e.code!=='EEXIST')throw e}this.key=await readFile(file)}if(this.key.length!==32)throw Error('Invalid download signing key')}
 private sign(jobId:string,name:string,expires:string){return createHmac('sha256',this.key).update(JSON.stringify(['artifact-v1',jobId,name,expires])).digest('base64url')}
 link(job:any,name:string,now=Date.now()){if(job.status!=='succeeded'||!job.expiresAt||Date.parse(job.expiresAt)<=now)return;const expires=String(Math.floor(Math.min(now+15*60*1000,Date.parse(job.expiresAt))/1000));const url=new URL('/downloads/'+encodeURIComponent(job.id)+'/'+encodeURIComponent(name),this.origin);url.searchParams.set('expires',expires);url.searchParams.set('token',this.sign(job.id,name,expires));return {filename:name,mimeType:artifactMime(name),downloadUrl:url.toString(),downloadExpiresAt:new Date(Number(expires)*1000).toISOString()}}
 valid(jobId:string,name:string,url:URL,now=Date.now()){const expires=url.searchParams.get('expires')||'',token=url.searchParams.get('token')||'';if(!/^\d{10}$/.test(expires)||Number(expires)*1000<=now||Number(expires)*1000>now+15*60*1000||!/^[a-zA-Z0-9_-]{43}$/.test(token))return false;const expected=this.sign(jobId,name,expires);return timingSafeEqual(Buffer.from(token),Buffer.from(expected))}
}
