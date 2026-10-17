#!/usr/bin/env python3
"""Run only after explicit approval. Reads a locally generated token from stdin; never prints it."""
import json,os,re,sys
from pathlib import Path
if os.geteuid()!=0:
    raise SystemExit('Root is required to create the protected service environment file')
token=sys.stdin.read(256).strip()
if not re.fullmatch(r'[a-f0-9]{64}',token):
    raise SystemExit('Expected a 32-byte token encoded as 64 lowercase hex characters')
folder=Path('/etc/x402-media-studio')
folder.mkdir(mode=0o700,exist_ok=True)
target=folder/'api.env'
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:
    f.write("API_ACCOUNTS_JSON='"+json.dumps({'owner':token},separators=(',',':'))+"'\n")
print('Created protected API environment file; token not displayed. Existing files are never replaced.')
