import {createServer} from 'node:http';
import {lookup} from 'node:dns/promises';
import {connect, isIP, type Socket} from 'node:net';

const frontends = new Set(['raw.githubusercontent.com', 'media.w3.org', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtubei.googleapis.com', 'i.ytimg.com', 'www.google.com']);
export function isYouTubeTunnel(host: string): boolean {
  return youtubeHosts.has(host) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.googlevideo\.com$/.test(host);
}
function allowedTunnel(host: string): boolean {
  return frontends.has(host) || isYouTubeTunnel(host);
}
/** Conservative globally routable IPv4 policy; special-purpose ranges are denied. */
export function isPublicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
/** Conservative global-unicast IPv6 only; reject local, mapped and special-use ranges. */
function isPublicIPv6(ip: string): boolean {
  if (isIP(ip) !== 6 || ip.includes('%')) return false;
  const [first, second] = ip.toLowerCase().split(':').map(part=>parseInt(part || '0',16));
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
    first !== 0x2002 && !(first === 0x3fff && second < 0x1000);
}
export function validateRemoteUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password ||
      !frontends.has(url.hostname) || isIP(url.hostname) || url.hash) throw Error('Unsupported media URL: use an allowed HTTPS host on port 443');
  if (['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)) {
    if (url.searchParams.has('list') || url.searchParams.has('index') || url.searchParams.has('live') ||
        /^\/(playlist|live|channel|user|@|feed|results)/i.test(url.pathname)) throw Error('Playlists, live streams and channel URLs are not supported');
    const valid = url.hostname === 'youtu.be' ? /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname) :
      ((url.pathname === '/watch' && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '')) || /^\/shorts\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname));
    if (!valid) throw Error('Use a single YouTube video URL');
  }
  return url;
}
/** TLS remains end-to-end. The caller must enforce an OS egress guard around the client.
 * youtubeProxy must be a private loopback SSH forward to our enforcing home relay.
 * DNS validation/address pinning for chained requests happens at that home relay.
 * homeRelay is long-lived: job byte/connection budgets remain enforced by the VPS's per-job proxy.
 */
export async function startImportProxy(options: {maxBytes?: number;socketPath?:string;port?:number;youtubeProxy?:string;homeRelay?:boolean} = {}): Promise<{port: number;diagnostics():{deniedHosts:string[]}; close(): Promise<void>}> {
  const maxBytes = options.maxBytes ?? 108 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw Error('Invalid proxy byte limit');
  if (options.port !== undefined && (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)) throw Error('Invalid proxy listen port');
  let youtubeProxy: URL | undefined;
  if (options.youtubeProxy !== undefined) {
    try { youtubeProxy = new URL(options.youtubeProxy); } catch { throw Error('YouTube proxy must be a loopback HTTP SSH forward'); }
    if (youtubeProxy.protocol !== 'http:' || youtubeProxy.hostname !== '127.0.0.1' || !youtubeProxy.port || youtubeProxy.username || youtubeProxy.password || youtubeProxy.pathname !== '/' || youtubeProxy.search || youtubeProxy.hash || options.homeRelay) throw Error('YouTube proxy must be a loopback HTTP SSH forward');
  }
  const sockets = new Set<Socket>();const deniedHosts=new Set<string>();
  let total = 0, active = 0, used = 0, closed = false;
  const server = createServer((_req,res) => {res.writeHead(403, {'Connection':'close'});res.end('HTTPS CONNECT required');});
  server.headersTimeout = 10_000;
  server.on('connection', socket => {sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setTimeout(30_000,()=>socket.destroy());socket.on('error',()=>{});});
  server.on('connect', (req, client, head) => {
    const socket = client as Socket;
    const match = /^([a-z0-9.-]+):443$/.exec(req.url || '');
    const deny = () => {if (!socket.destroyed) socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');};
    const allowed = match && (options.homeRelay ? isYouTubeTunnel(match[1]) : allowedTunnel(match[1]));
    if(match&&!allowed&&deniedHosts.size<8)deniedHosts.add(match[1]);
    if (closed || !match || !allowed || isIP(match[1]) || (!options.homeRelay && (used >= 64 || active >= 8 || total >= maxBytes))) {deny();return;}
    used++; active++;
    let upstream: Socket | undefined;
    let finished = false;
    const finish = () => {if (finished) return;finished=true;clearTimeout(deadline);active--;socket.destroy();upstream?.destroy();};
    const deadline = setTimeout(finish,30_000);
    socket.once('close',finish);
    const charge = (chunk: Buffer | string) => {
      if (options.homeRelay) return true;
      total += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (total > maxBytes) {for (const s of sockets) s.destroy();return false;}
      return true;
    };
    const track = (peer: Socket) => {
      upstream = peer;
      sockets.add(peer);peer.once('close',()=>{sockets.delete(peer);finish();});
      peer.on('error',finish);peer.setTimeout(30_000,finish);
    };
    const bridge = (peerHead: Buffer = Buffer.alloc(0)) => {
      if (finished || closed) {upstream?.destroy();return;}
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (peerHead.length && charge(peerHead)) socket.write(peerHead);
      if (head.length && charge(head)) upstream!.write(head);
      socket.on('data',chunk=>{if(charge(chunk) && !upstream!.write(chunk)) socket.pause();});
      upstream!.on('drain',()=>socket.resume());
      upstream!.on('data',chunk=>{if(charge(chunk) && !socket.write(chunk)) upstream!.pause();});
      socket.on('drain',()=>upstream?.resume());
      socket.on('end',()=>upstream?.end());upstream!.on('end',()=>socket.end());
    };
    if (youtubeProxy && isYouTubeTunnel(match[1])) {
      // Never fall back to Oracle egress on tunnel errors. Home relay validates and pins DNS.
      const target = match[1] + ':443';
      // Raw CONNECT avoids Bun's node:http client routing CONNECT through fetch().
      const peer = connect({host:youtubeProxy.hostname,port:Number(youtubeProxy.port),family:4});
      track(peer);
      let response = Buffer.alloc(0);
      const handshake = (chunk: Buffer) => {
        response = Buffer.concat([response,chunk]);
        const end = response.indexOf('\r\n\r\n');
        if (end < 0) {if (response.length > 8192) finish();return;}
        if (end > 8192 || !/^HTTP\/1\.[01] 200(?: |\r)/.test(response.toString('latin1',0,end+2))) {finish();return;}
        peer.off('data',handshake);
        const peerHead = response.subarray(end+4);response=Buffer.alloc(0);
        bridge(peerHead);
      };
      peer.on('data',handshake);
      peer.once('connect',()=>{if (!finished && !closed) peer.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`);});
      return;
    }
    void (async()=>{
      try {
        // Home IPv4 is rate-limited; use home IPv6 without silently falling back.
        // Ordinary direct VPS/fixture traffic retains its existing IPv4 policy.
        const family = options.homeRelay ? 6 : 4;
        const answers = await lookup(match[1], {all:true,family});
        if (closed || finished) return;
        const isPublic = family === 6 ? isPublicIPv6 : isPublicIPv4;
        if (!answers.length || answers.some(answer=>!isPublic(answer.address))) {deny();return;}
        const peer = connect({host:answers[0].address,port:443,family});
        track(peer);peer.once('connect',()=>bridge());
      } catch {deny();}
    })();
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);options.socketPath?server.listen(options.socketPath,resolve):server.listen(options.port ?? 0,'127.0.0.1',resolve);});
  const address = server.address();
  if (!address) throw Error('Proxy listener unavailable');
  return {port:typeof address==='string'?0:address.port,diagnostics:()=>({deniedHosts:[...deniedHosts]}),close:async()=>{closed=true;for(const socket of sockets) socket.destroy();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
