"""Dependency-free structural checks; not a substitute for browser layout tests."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Site(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.download = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs['id'])
        for key in ('src', 'href', 'data-full'):
            value = attrs.get(key)
            if value:
                self.refs.append(value)
        if attrs.get('id') == 'dlBtn':
            self.download = attrs

site = Site()
site.feed((ROOT / 'index.html').read_text())
for ref in site.refs:
    if ref.startswith('#'):
        assert ref[1:] in site.ids, f'Missing anchor: {ref}'
    elif not ref.startswith(('https:', 'http:')):
        assert (ROOT / ref.lstrip('/')).is_file(), f'Missing asset: {ref}'
manifest = json.loads((ROOT / 'data/release.json').read_text())
assert site.download['href'] == manifest['downloadUrl'] == '/apk/SCS.apk'
assert 'download' in site.download
apk = (ROOT / 'apk/SCS.apk').read_bytes()
assert hashlib.sha256(apk).hexdigest() == manifest['sha256']
assert len(apk) == manifest['fileSizeBytes']
print(f'PASS: {len(site.ids)} unique IDs, local assets/anchors, original APK URL, size and SHA-256')
