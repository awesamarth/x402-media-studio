"""Loopback TCP to mounted Unix socket; container has --network none."""
import os, selectors, socket, socketserver, subprocess, sys, threading
class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        upstream=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        try:
            upstream.connect('/proxy/proxy.sock')
            self.request.settimeout(30); upstream.settimeout(30)
            with selectors.DefaultSelector() as sel:
                sel.register(self.request,selectors.EVENT_READ,upstream)
                sel.register(upstream,selectors.EVENT_READ,self.request)
                while True:
                    ready=sel.select(30)
                    if not ready: return
                    for key,_ in ready:
                        data=key.fileobj.recv(65536)
                        if not data: return
                        key.data.sendall(data)
        finally: upstream.close()
class Server(socketserver.ThreadingTCPServer):
    daemon_threads=True
    allow_reuse_address=True
if __name__=='__main__':
    # Confirm the standard namespace has no non-loopback network interfaces.
    if any(line.split()[0]!='lo' for line in open('/proc/net/route').read().splitlines()[1:]):
        raise SystemExit('Importer requires --network none')
    with Server(('127.0.0.1',7777),Relay) as server:
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            raise SystemExit(subprocess.run(['yt-dlp',*sys.argv[1:]],timeout=175).returncode)
        except subprocess.TimeoutExpired:
            raise SystemExit('Downloader deadline exceeded')
