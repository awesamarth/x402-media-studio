import {createServer} from 'node:http';
import {lookup} from 'node:dns/promises';
import {connect, isIP, type Socket} from 'node:net';

const frontends = new Set(['raw.githubusercontent.com', 'media.w3.org', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const tunnels = new Set([...frontends, 'youtubei.googleapis.com', 'i.ytimg.com']);
function allowedTunnel(host: string): boolean {
  return tunnels.has(host) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.googlevideo\.com$/.test(host);
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
/** TLS remains end-to-end. The caller must enforce an OS egress guard around the client. */
export async function startImportProxy(options: {maxBytes?: number} = {}): Promise<{port: number; close(): Promise<void>}> {
  const maxBytes = options.maxBytes ?? 108 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw Error('Invalid proxy byte limit');
  const sockets = new Set<Socket>();
  let total = 0, active = 0, used = 0, closed = false;
  const server = createServer((_req,res) => {res.writeHead(403, {'Connection':'close'});res.end('HTTPS CONNECT required');});
  server.headersTimeout = 10_000;
  server.on('connection', socket => {sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setTimeout(30_000,()=>socket.destroy());socket.on('error',()=>{});});
  server.on('connect', (req, client, head) => {
    const socket = client as Socket;
    const match = /^([a-z0-9.-]+):443$/.exec(req.url || '');
    const deny = () => {if (!socket.destroyed) socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');};
    if (closed || !match || !allowedTunnel(match[1]) || isIP(match[1]) || used >= 64 || active >= 8 || total >= maxBytes) {deny();return;}
    used++; active++;
    let upstream: Socket | undefined;
    let finished = false;
    const finish = () => {if (finished) return;finished=true;clearTimeout(deadline);active--;socket.destroy();upstream?.destroy();};
    const deadline = setTimeout(finish,30_000);
    socket.once('close',finish);
    const charge = (chunk: Buffer | string) => {
      total += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (total > maxBytes) {for (const s of sockets) s.destroy();return false;}
      return true;
    };
    void (async()=>{
      try {
        const answers = await lookup(match[1], {all:true,family:4});
        if (closed || finished) return;
        if (!answers.length || answers.some(answer=>!isPublicIPv4(answer.address))) {deny();return;}
        upstream = connect({host:answers[0].address,port:443,family:4});
        sockets.add(upstream);upstream.once('close',()=>{sockets.delete(upstream!);finish();});
        upstream.on('error',finish);upstream.setTimeout(30_000,finish);
        upstream.once('connect',()=>{
          if (finished || closed) {finish();return;}
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length && charge(head)) upstream!.write(head);
          socket.on('data',chunk=>{if(charge(chunk) && !upstream!.write(chunk)) socket.pause();});
          upstream!.on('drain',()=>socket.resume());
          upstream!.on('data',chunk=>{if(charge(chunk) && !socket.write(chunk)) upstream!.pause();});
          socket.on('drain',()=>upstream?.resume());
          socket.on('end',()=>upstream?.end());upstream!.on('end',()=>socket.end());
        });
      } catch {deny();}
    })();
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Proxy listener unavailable');
  return {port:address.port,close:async()=>{closed=true;for(const socket of sockets) socket.destroy();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
