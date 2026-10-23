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

html = (ROOT / 'index.html').read_text()
assert 'Play in Browser' not in html
assert 'sins-of-chaotic-shadows.vercel.app' not in html
assert 'NO SIGN-UP REQUIRED' not in html.upper()
assert 'Play fully offline' not in html
assert 'Offline Mode — Coming Soon' in html
assert 'Offline gameplay is planned for a future update. Stay tuned for upcoming releases.' in html
assert 'Security Scan Notice:' in html and 'Tap “Scan app”' in html
assert 'installing over it keeps your local progress.' in html
assert 'updates' in site.ids
notes = html.split('<ol class="updates-list">', 1)[1].split('</ol>', 1)[0]
import re
versions = re.findall(r'<span class="mono">([\d.]+)</span>', notes)
assert versions == sorted(versions, key=lambda v: tuple(map(int, v.split('.'))), reverse=True)
assert len(versions) == len(set(versions))
assert versions == ['0.23.0', '0.22.1', '0.22.0', '0.21.0', '0.20.0']
assert re.findall(r'<time datetime="([^"]+)">', notes) == [manifest['releaseDate']]
assert 'Documented game update' in notes and 'Separate gameplay changes' in notes
print('PASS: browser-play removal, offline notice, installation instructions and newest-first documented changelog')
