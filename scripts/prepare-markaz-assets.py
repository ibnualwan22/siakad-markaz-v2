"""Embed textures in official Kenney GLBs. Usage: python3 scripts/prepare-markaz-assets.py EXTRACTED_PACKS_DIR"""
import json
from pathlib import Path
import shutil
import struct
import sys

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'public/models/markaz'
target.mkdir(parents=True, exist_ok=True)
models = [
    ('city-kit-suburban', 'building-type-a', 'house-a', 'Rumah warga A'),
    ('city-kit-suburban', 'building-type-h', 'house-b', 'Rumah warga B'),
    ('city-kit-suburban', 'building-type-r', 'house-c', 'Rumah warga C'),
    ('city-kit-industrial', 'building-i', 'hall', 'Gedung aula'),
    ('blocky-characters', 'character-a', 'character', 'Karakter penjelajah'),
]
manifest = []
for pack, model, name, label in models:
    path = next((source / pack).rglob(model + '.glb'))
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    binary = bytearray(raw[28 + size:])
    for image in doc.get('images', []):
        uri = image.pop('uri', None)
        if uri:
            data = (path.parent / uri).read_bytes()
            binary += b'\0' * (-len(binary) % 4)
            image['bufferView'] = len(doc['bufferViews'])
            image['mimeType'] = 'image/png'
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
            binary += data
    binary += b'\0' * (-len(binary) % 4)
    doc['buffers'] = [{'byteLength': len(binary)}]
    doc['asset']['copyright'] = 'Kenney (kenney.nl), CC0 1.0'
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(binary))
    result += struct.pack('<II', len(header), 0x4e4f534a) + header
    result += struct.pack('<II', len(binary), 0x004e4942) + binary
    (target / (name + '.glb')).write_bytes(result)
    shutil.copy(source / pack / 'Previews' / (model + '.png'), target / (name + '.png'))
    shutil.copy(source / pack / 'License.txt', target / (pack + '-LICENSE.txt'))
    vertices = sum(doc['accessors'][p['attributes']['POSITION']]['count'] for m in doc['meshes'] for p in m['primitives'])
    manifest.append({'id': 'builtin-' + name, 'name': label, 'url': '/models/markaz/' + name + '.glb', 'bytes': len(result), 'vertices': vertices})
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
