import {test,expect} from 'bun:test';
import {connect} from 'node:net';
import {createServer} from 'node:http';
import {isPublicIPv4,validateRemoteUrl,startImportProxy,isYouTubeTunnel} from '../src/import-proxy';
test('import proxy rejects special-use IPv4 and accepts global addresses',()=>{
  for(const ip of ['0.0.0.0','10.1.1.1','127.0.0.1','169.254.169.254','100.64.1.2','100.127.255.255','172.16.0.1','172.31.255.255','192.168.1.2','192.0.0.1','192.0.2.1','192.88.99.1','198.18.0.1','198.19.255.255','198.51.100.2','203.0.113.1','224.0.0.1','239.1.1.1','240.0.0.1','255.255.255.255','::1','bad']) expect(isPublicIPv4(ip)).toBe(false);
  for(const ip of ['1.1.1.1','8.8.8.8','100.128.0.1','172.32.0.1']) expect(isPublicIPv4(ip)).toBe(true);
});
test('submitted URLs restrict HTTPS hosts and reject playlists, live paths and literals',()=>{
  for(const url of ['http://media.w3.org/a.mp4','https://u:p@media.w3.org/a','https://media.w3.org:8443/a','https://127.0.0.1/a','https://[::1]/a','https://example.com/a','https://media.w3.org.evil.test/a','https://www.youtube.com/playlist?list=abc','https://youtu.be/abcdefghijk?list=abc','https://www.youtube.com/live/abcdefghijk','https://www.youtube.com/@channel','https://www.youtube.com/watch?v=x']) expect(()=>validateRemoteUrl(url)).toThrow();
  for(const url of ['https://raw.githubusercontent.com/owner/repo/main/a.wav','https://media.w3.org/a.mp4','https://www.youtube.com/watch?v=abcdefghijk','https://youtu.be/abcdefghijk']) expect(validateRemoteUrl(url).protocol).toBe('https:');
});
test('proxy denies disallowed CONNECT and plaintext requests without resolving upstream',async()=>{
  const proxy=await startImportProxy();
  try {
    for(const request of ['CONNECT localhost:443 HTTP/1.1\r\nHost: localhost\r\n\r\n','CONNECT media.w3.org:80 HTTP/1.1\r\nHost: media.w3.org\r\n\r\n','CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: localhost\r\n\r\n','GET http://media.w3.org/a HTTP/1.1\r\nHost: media.w3.org\r\nConnection: close\r\n\r\n']) {
      const response=await new Promise<string>((resolve,reject)=>{let result='';const socket=connect(proxy.port,'127.0.0.1',()=>socket.write(request));socket.on('data',chunk=>result+=chunk);socket.on('end',()=>resolve(result));socket.on('error',reject);socket.setTimeout(2000,()=>{socket.destroy();reject(Error('Proxy response timed out'));});});
      expect(response).toContain('403');
    }
  } finally {await proxy.close();}
});

function exchange(port:number,host:string,payload='') {
  return new Promise<string>((resolve,reject)=>{
    let output='';
    const socket=connect(port,'127.0.0.1',()=>socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n${payload}`));
    socket.on('data',chunk=>output+=chunk);
    socket.on('close',()=>resolve(output));socket.on('error',reject);
    socket.setTimeout(2000,()=>{socket.destroy();reject(Error('Proxy test timed out'));});
  });
}

test('YouTube routing matches exact domains, not lookalikes or arbitrary Google hosts',()=>{
  for(const host of ['youtube.com','www.youtube.com','m.youtube.com','youtu.be','youtubei.googleapis.com','i.ytimg.com','www.google.com','rr1---sn-abc.googlevideo.com']) expect(isYouTubeTunnel(host)).toBe(true);
  for(const host of ['youtube.com.evil.test','evilgooglevideo.com','googlevideo.com.evil.test','accounts.google.com','example.com','127.0.0.1','media.w3.org','raw.githubusercontent.com']) expect(isYouTubeTunnel(host)).toBe(false);
});

test('home relay refuses non-YouTube destinations',async()=>{
  const proxy=await startImportProxy({homeRelay:true});
  try {for(const host of ['media.w3.org','raw.githubusercontent.com','127.0.0.1','example.com']) expect(await exchange(proxy.port,host)).toContain('403');}
  finally {await proxy.close();}
});

test('upstream must be an explicit loopback SSH forward',async()=>{
  for(const youtubeProxy of ['', 'http://example.com:1234','https://127.0.0.1:1234','http://127.0.0.1','http://u:p@127.0.0.1:1234','http://127.0.0.1:1234/path','http://127.0.0.1:1234/?x=1']) {
    await expect(startImportProxy({youtubeProxy})).rejects.toThrow('loopback');
  }
});

test('chained CONNECT retains both handshake buffers and forwards only an allowed target',async()=>{
  let target='',received='';
  const upstream=createServer();
  upstream.on('connect',(req,socket,head)=>{
    target=req.url!;
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\npeer-head');
    const echo=(chunk:Buffer)=>{received+=chunk.toString();socket.end('echo:'+received);};
    if(head.length) echo(head);else socket.once('data',echo);
  });
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const port=(upstream.address() as {port:number}).port;
  const proxy=await startImportProxy({youtubeProxy:`http://127.0.0.1:${port}`});
  try {
    expect(await exchange(proxy.port,'example.com')).toContain('403');expect(target).toBe('');
    const output=await exchange(proxy.port,'fixture.googlevideo.com','client-head');
    expect(target).toBe('fixture.googlevideo.com:443');expect(received).toBe('client-head');
    expect(output).toContain('200 Connection Established');expect(output).toContain('peer-head');expect(output).toContain('echo:client-head');
  } finally {await proxy.close();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

test('chained proxy accepts fragmented headers and rejects oversized handshake headers',async()=>{
  let oversized=false;
  const upstream=createServer();
  upstream.on('connect',(_req,socket)=>{
    if(oversized) {socket.write('HTTP/1.1 200 OK\r\nX-Invalid: '+ 'a'.repeat(9000));return;}
    socket.write('HTTP/1.1 200');
    setTimeout(()=>socket.end(' Connection Established\r\n\r\nfragmented-peer-data'),5);
  });
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const port=(upstream.address() as {port:number}).port;
  const proxy=await startImportProxy({youtubeProxy:`http://127.0.0.1:${port}`});
  try {
    expect(await exchange(proxy.port,'fixture.googlevideo.com')).toContain('fragmented-peer-data');
    oversized=true;
    expect(await exchange(proxy.port,'fixture.googlevideo.com')).not.toContain('200');
  } finally {await proxy.close();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

test('upstream rejection or connection failure never establishes a direct tunnel',async()=>{
  const upstream=createServer();
  upstream.on('connect',(_req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const port=(upstream.address() as {port:number}).port;
  const proxy=await startImportProxy({youtubeProxy:`http://127.0.0.1:${port}`});
  try {
    expect(await exchange(proxy.port,'www.youtube.com')).not.toContain('200');
    await new Promise<void>(resolve=>upstream.close(()=>resolve()));
    expect(await exchange(proxy.port,'www.youtube.com')).not.toContain('200');
  } finally {await proxy.close();upstream.close();}
});

