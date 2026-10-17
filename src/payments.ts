import {createHash} from 'node:crypto';
import type {Studio} from './core';
export type PaymentConfig={recipient:string;facilitator:string;origin:string;network:'eip155:8453';payer:string;owner:string};
export const USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export function paymentConfig():PaymentConfig|undefined {
 if(process.env.PAYMENTS_ENABLED!=='true')return;
 const recipient=process.env.PAYMENT_RECIPIENT||'',facilitator=process.env.PAYMENT_FACILITATOR||'',origin=process.env.PUBLIC_API_ORIGIN||'';
 if(!/^0x[\da-fA-F]{40}$/.test(recipient)||/^0x0{40}$/.test(recipient))throw Error('Set a valid public PAYMENT_RECIPIENT');
 for(const value of [facilitator,origin]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.port)throw Error('Payment URLs must be exact HTTPS origins on port 443')}
 if(process.env.PAYMENT_NETWORK!=='eip155:8453')throw Error('Set PAYMENT_NETWORK=eip155:8453; only Base USDC is implemented');
 if(!process.env.LOCAL_DEV_TOKEN)throw Error('Configure authenticated data access before enabling payment');
 const payer=process.env.ACCOUNT_PAYER||'';if(!/^0x[\da-fA-F]{40}$/.test(payer))throw Error('Set ACCOUNT_PAYER to the account public Base wallet');
 return {recipient,facilitator,origin,network:'eip155:8453',payer,owner:digest(process.env.LOCAL_DEV_TOKEN!)};
}
export const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64');
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function canonical(v:any):string{return v&&typeof v==='object'?Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)}
export class Payments {
 tail:Promise<unknown>=Promise.resolve();
 constructor(public studio:Studio,public config?:PaymentConfig,public transport:typeof fetch=fetch,public fixtureOnlyAllowUnbound=false){}
 async facilitator(action:string,payload:unknown){const r=await this.transport(`${this.config!.facilitator}/${action}`,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Facilitator response unavailable');const text=await r.text();if(text.length>65536)throw Error('Facilitator response too large');return JSON.parse(text)}
 purchase(body:any,signature:string|null){const next=this.tail.then(()=>this.run(body,signature));this.tail=next.catch(()=>{});return next}
 async run(body:any,signature:string|null):Promise<Response>{
 const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers});
 if(!this.config)return json({error:'Payment is unconfigured; no payment accepted'},503);
 if(signature&&!this.fixtureOnlyAllowUnbound)return json({error:'Paid execution disabled: quote binding unresolved'},503);
 if(!body||typeof body.quoteId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.idempotencyKey)||Object.keys(body).some(k=>!['quoteId','idempotencyKey'].includes(k)))return json({error:'Use quoteId and a stable idempotencyKey only'},400);
 let q;try{q=await this.studio.read('quotes',body.quoteId)}catch{return json({error:'Quote not found'},404)}
 // Quote ownership is retained server-side. The public paid request does not disclose its workflow or bearer token.
 if(!q.owner||q.owner!==this.config.owner)return json({error:'Quote requires authenticated ownership'},409);
 let prior:any;try{prior=await this.studio.read('payments',q.id)}catch(e:any){if(e.code!=='ENOENT')throw e}
 if(prior&&!this.fixtureOnlyAllowUnbound)return json({error:'Purchase execution disabled pending binding/reconciliation review'},503);
 if(prior){if(prior.key!==body.idempotencyKey)return json({error:'Quote already bound to a purchase; inspect authenticated quote status'},409);
 if(prior.status==='settled'){const j=await this.studio.enqueue(q.id,prior.jobKey,true);return json({jobId:j.id,paymentStatus:'settled',transaction:prior.settlement.transaction},200,{'PAYMENT-RESPONSE':encoded(prior.settlement)})}
 return json({paymentStatus:'reconciliation_required',quoteId:q.id,message:'Do not purchase again. Settlement may have been broadcast; operator must reconcile.'},202)}
 if(Date.parse(q.expiresAt)<=Date.now())return json({error:'Quote expired'},410);
 const requirements={scheme:'exact',network:this.config.network,amount:q.amountAtomic,asset:USDC,payTo:this.config.recipient,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}};
 const resource={url:new URL('/workflows',this.config.origin).toString(),description:'Enqueue quoted media workflow',mimeType:'application/json'};
 const challenge={x402Version:2,resource,accepts:[requirements]};
 if(!signature)return json(challenge,402,{'PAYMENT-REQUIRED':encoded(challenge)});
 if(!this.fixtureOnlyAllowUnbound)return json({error:'Paid execution disabled: quote-to-authorization binding is unresolved. Do not pay or retry.'},503);
 let payment:any;try{if(signature.length>32768||!/^[A-Za-z0-9+/]+={0,2}$/.test(signature))throw Error();payment=JSON.parse(Buffer.from(signature,'base64').toString());if(payment.x402Version!==2||canonical(payment.accepted)!==canonical(requirements)||!payment.payload)throw Error()}catch{return json({error:'Invalid x402 payload or mismatched requirements'},400)}
 const auth=payment.payload.authorization;
 if(!auth||auth.from?.toLowerCase()!==this.config.payer.toLowerCase()||!/^0x[\da-fA-F]{64}$/.test(auth.nonce)||!/^0x[\da-fA-F]{40}$/.test(auth.from)||auth.to?.toLowerCase()!==this.config.recipient.toLowerCase()||auth.value!==q.amountAtomic)return json({error:'Invalid exact EVM authorization'},400);
 const replayId=digest(`${this.config.network}:${USDC.toLowerCase()}:${auth.from.toLowerCase()}:${auth.nonce.toLowerCase()}`);
 try{await this.studio.read('receipts',replayId);return json({error:'Authorization already reserved for a purchase; do not pay again'},409)}catch(e:any){if(e.code!=='ENOENT')throw e}
 const request={x402Version:2,paymentPayload:payment,paymentRequirements:requirements};let verified;
 try{verified=await this.facilitator('verify',request)}catch{return json({error:'Verification unavailable; no settlement attempted'},503)}
 if(verified.isValid!==true||verified.payer?.toLowerCase()!==auth.from.toLowerCase())return json({error:'Payment verification rejected'},402,{'PAYMENT-REQUIRED':encoded(challenge)});
 // Persist reservation BEFORE settlement. Any unknown outcome remains pending, never automatically re-settled.
 const state={id:q.id,owner:q.owner,key:body.idempotencyKey,jobKey:'paid-'+q.id,status:'pending',replayId,settlement:undefined as any};
 await this.studio.save('receipts',replayId,{quoteId:q.id});await this.studio.save('payments',q.id,state);
 let settled;try{settled=await this.facilitator('settle',request)}catch{return json({paymentStatus:'reconciliation_required',quoteId:q.id},202)}
 state.settlement=settled;
 if(settled.success!==true||!/^0x[\da-fA-F]{64}$/.test(settled.transaction)||settled.network!==this.config.network||settled.payer?.toLowerCase()!==auth.from.toLowerCase()){
 await this.studio.save('payments',q.id,state);return json({paymentStatus:'reconciliation_required',quoteId:q.id,message:'No job enqueued. Inspect facilitator outcome before any new payment.'},202)}
 state.status='settled';await this.studio.save('payments',q.id,state);const j=await this.studio.enqueue(q.id,state.jobKey,true);
 return json({jobId:j.id,paymentStatus:'settled',transaction:settled.transaction},202,{'PAYMENT-RESPONSE':encoded(settled)});
 }
}
