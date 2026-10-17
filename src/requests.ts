import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readdir,unlink} from 'node:fs/promises';
import {Studio} from './core';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export class Requests {
 private tail:Promise<unknown>=Promise.resolve();private rates=new Map<string,{count:number;until:number}>();
 constructor(private studio:Studio){}
 async init(){await mkdir(this.studio.path('requests'),{recursive:true})}
 private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.tail.then(work);this.tail=next.catch(()=>{});return next}
 async authenticate(handle:string|null){if(!handle||!/^[a-f0-9]{64}$/.test(handle))return;try{const session=await this.studio.read('requests',hash(handle));return Date.parse(session.expiresAt)>Date.now()?session:undefined}catch{return}}
 async create(ip:string){return this.serial(async()=>{
  const now=Date.now();for(const [key,value] of this.rates)if(value.until<=now)this.rates.delete(key);
  if(this.rates.size>128)throw Error('Request admission is busy; retry later');const rate=this.rates.get(ip)||{count:0,until:now+60000};if(rate.count>=5)throw Error('At most five new requests per minute');rate.count++;this.rates.set(ip,rate);
  const files=(await readdir(this.studio.path('requests'))).filter(f=>f.endsWith('.json'));let active=0;
  for(const file of files){const r=await this.studio.read('requests',file.slice(0,-5));if(Date.parse(r.expiresAt)>now){active++;continue}await this.expire(r)}
  if(active>=64)throw Error('Request capacity reached; retry later');await this.studio.checkStorage();
  const handle=randomBytes(32).toString('hex');const session={id:hash(handle),owner:'request-'+randomUUID(),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+3600000).toISOString(),uploads:0,quotes:0};await this.studio.save('requests',session.id,session);
  return {requestId:session.owner,requestHandle:handle,expiresAt:session.expiresAt,limits:{uploads:1,quotes:4,maxUploadBytes:104857600},next:'Use X-Request-Handle for this request’s upload, quote, polling and artifact calls. No API key or signup.'};
 })}
 async consume(session:any,kind:'uploads'|'quotes'){return this.serial(async()=>{const current=await this.studio.read('requests',session.id);if(Date.parse(current.expiresAt)<=Date.now())throw Error('Request handle expired');if(current[kind]>=(kind==='uploads'?1:4))throw Error('This request has reached its '+kind+' limit');current[kind]++;await this.studio.save('requests',current.id,current)})}
 private async expire(session:any){
  const quotes=[];for(const file of (await readdir(this.studio.path('quotes'))).filter(f=>f.endsWith('.json'))){const q=await this.studio.read('quotes',file.slice(0,-5));if(q.owner===session.owner)quotes.push(q)}
  for(const q of quotes){try{await this.studio.read('payments',q.id);return}catch(e:any){if(e.code!=='ENOENT')throw e}}
  for(const file of (await readdir(this.studio.path('jobs'))).filter(f=>f.endsWith('.json')))if((await this.studio.read('jobs',file.slice(0,-5))).owner===session.owner)return;
  const assets=new Set<string>();for(const file of (await readdir(this.studio.path('assetAccess'))).filter(f=>f.endsWith('.json'))){const grant=await this.studio.read('assetAccess',file.slice(0,-5));if(grant.owner===session.owner){assets.add(grant.assetId);await unlink(this.studio.path('assetAccess',file))}}
  const referenced=new Set<string>();for(const file of (await readdir(this.studio.path('assetAccess'))).filter(f=>f.endsWith('.json')))referenced.add((await this.studio.read('assetAccess',file.slice(0,-5))).assetId);
  for(const id of assets)if(!referenced.has(id)){await unlink(this.studio.path('assets',id)).catch(()=>{});await unlink(this.studio.path('assets',id+'.json')).catch(()=>{})}
  for(const q of quotes)await unlink(this.studio.path('quotes',q.id+'.json'));await unlink(this.studio.path('requests',session.id+'.json'));
 }
}
