import {createHash,timingSafeEqual} from 'node:crypto';
export type Accounts=Map<string,string>;
export function loadAccounts():Accounts{
 const result=new Map<string,string>();
 if(process.env.API_ACCOUNTS_JSON){let parsed:any;try{parsed=JSON.parse(process.env.API_ACCOUNTS_JSON)}catch{throw Error('API_ACCOUNTS_JSON must map account IDs to bearer tokens')}
 if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error('Invalid account configuration');
 for(const [id,token] of Object.entries(parsed)){if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||typeof token!=='string'||token.length<8)throw Error('Invalid account configuration');result.set(id,token)}}
 else if(process.env.LOCAL_DEV_TOKEN)result.set('local-owner',process.env.LOCAL_DEV_TOKEN);
 if(new Set(result.values()).size!==result.size)throw Error('Accounts must have distinct bearer tokens');return result;
}
export function principal(header:string|null,accounts:Accounts){if(!header?.startsWith('Bearer '))return;const hash=(v:string)=>createHash('sha256').update(v).digest();const incoming=hash(header.slice(7));for(const [id,token] of accounts)if(timingSafeEqual(incoming,hash(token)))return id}
