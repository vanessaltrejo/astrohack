from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
errors=[];n=0
for line in (root/'SHA256SUMS.txt').read_text().splitlines():
    expected,name=line.split('  ',1);p=root/name;n+=1
    if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:errors.append(name)
print(f'{n} archivos comprobados; {len(errors)} errores')
for name in errors:print(name)
raise SystemExit(bool(errors))
