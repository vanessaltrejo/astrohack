"""Descarga opcional y reconstruye cubos. ~416 MB de red + temporales; no necesaria para estudiantes.
Ejecuta desde cualquier directorio: python descargar_origen.py
Requiere numpy y astropy. No calibra datos. No sobrescribe el paquete entregado.
"""
from pathlib import Path
import json,urllib.request,urllib.parse,hashlib
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
root=Path(__file__).resolve().parents[1]
meta=json.loads((root/'procedencia.json').read_text())
dest=root/'reconstruccion';dest.mkdir(exist_ok=True)
for win in meta['ventanas']:
    url='https://almascience.eso.org/soda/sync?'+urllib.parse.urlencode({'ID':win['SODA_ID'],'POS':win['SODA_POS']})
    src=dest/(win['nombre']+'_SODA.fits')
    if not src.exists():
        print('Descargando',win['nombre'],'(aprox. 208 MB)')
        with urllib.request.urlopen(url,timeout=180) as r,open(src,'wb') as f:
            while True:
                b=r.read(1024*1024)
                if not b:break
                f.write(b)
    with fits.open(src,memmap=True) as hd:
        h=hd[0].header;d=hd[0].data.squeeze();w=WCS(h).sub(['longitude','latitude','spectral'])
        x0,x1=win['corte_indices_python']['x'];y0,y1=win['corte_indices_python']['y']
        sl=(slice(None),slice(y0,y1),slice(x0,x1));newh=w.slice(sl).to_header()
        for k in ['BUNIT','BMAJ','BMIN','BPA','SPECSYS','OBJECT','TELESCOP','INSTRUME','RADESYS','EQUINOX']:
            if k in h:newh[k]=h[k]
        out=dest/(win['nombre']+'_reconstruido.fits');fits.writeto(out,d[sl],newh,overwrite=True,checksum=True)
        packaged=root/'cubos'/f"{win['nombre']}_IRAS16293.fits"
        if packaged.exists():
            assert np.array_equal(fits.getdata(packaged),d[sl],equal_nan=True),'Datos difieren: revisar nueva versión del archivo'
            print(win['nombre'],'valores idénticos al paquete; headers históricos pueden diferir')
print('Origen:',meta['MOUS'],'; revisar procedencia antes de redistribuir una nueva versión.')
