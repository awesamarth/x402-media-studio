import {request} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {lookup} from 'node:dns/promises';
import {isPublicIPv4,validateRemoteUrl} from './import-proxy';
import {MAX_UPLOAD_BYTES} from './limits';
export function isDirectFileSource(input:string){try{const u=validateRemoteUrl(input);return ['raw.githubusercontent.com','media.w3.org'].includes(u.hostname)&&/\.(wav|mp3|m4a|mp4|webm|flac|ogg|aac|mov|mkv)$/i.test(u.pathname)}catch{return false}}
/** One controlled HTTPS request: fixed vetted address, normal hostname TLS, no redirects or extractor recursion. */
export async function fetchDirectFile(input:string):Promise<Uint8Array>{
 if(!isDirectFileSource(input))throw Error('Unsupported direct media file URL');const url=validateRemoteUrl(input);
 const answers=await lookup(url.hostname,{all:true,family:4});if(!answers.length||answers.some(a=>!isPublicIPv4(a.address)))throw Error('Direct media host did not resolve exclusively to public IPv4');
 return new Promise((resolve,reject)=>{let done=false;let bytes=0;const chunks:Buffer[]=[];
  const req=request({protocol:'https:',hostname:answers[0]!.address,port:443,path:url.pathname+url.search,method:'GET',family:4,agent:false,servername:url.hostname,checkServerIdentity:(_name,cert)=>checkServerIdentity(url.hostname,cert),headers:{host:url.hostname,accept:'audio/*,video/*,application/octet-stream','accept-encoding':'identity'}},res=>{
   if(res.statusCode!==200){res.destroy();finish(Error('Direct media HTTP '+res.statusCode+'; redirects are not followed'));return}
   const type=String(res.headers['content-type']||'').split(';')[0]!;
   if(!/^(audio\/|video\/|application\/octet-stream$)/i.test(type)){res.destroy();finish(Error('Direct URL did not return media bytes'));return}
   if(Number(res.headers['content-length'])>MAX_UPLOAD_BYTES){res.destroy();finish(Error('Direct media exceeds 100 MiB'));return}
   if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();finish(Error('Compressed direct responses are unsupported'));return}
   res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>MAX_UPLOAD_BYTES){res.destroy();finish(Error('Direct media exceeds 100 MiB'))}else chunks.push(chunk)});
   res.on('error',finish);res.on('end',()=>bytes?finish():finish(Error('Direct media response was empty')));
  });
  const timer=setTimeout(()=>finish(Error('Direct media request exceeded 90 seconds')),90000);
  function finish(error?:Error){if(done)return;done=true;clearTimeout(timer);if(error){req.destroy();reject(error)}else resolve(new Uint8Array(Buffer.concat(chunks)))}
  req.setTimeout(20000,()=>finish(Error('Direct media connection timed out')));req.on('error',finish);req.end();
 });
}
