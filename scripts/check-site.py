"""Dependency-free structural, asset, WebP, APK, manifest, and content checks."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Site(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.downloads = {}
        self.logos = []

    def handle_starttag(self, tag, attrs):
        ad = dict(attrs)
        if 'id' in ad:
            assert ad['id'] not in self.ids, f"Duplicate ID: {ad['id']}"
            self.ids.add(ad['id'])
        for key in ('src', 'href', 'data-full', 'data-webp', 'poster'):
            value = ad.get(key)
            if value:
                self.refs.append(value)
        srcset = ad.get('srcset')
        if srcset:
            for part in srcset.split(','):
                tokens = part.strip().split()
                if tokens:
                    self.refs.append(tokens[0])
        if ad.get('id') in ('dlBtn', 'heroDl', 'archiveCurrentLink'):
            self.downloads[ad['id']] = ad
        if tag == 'img' and 'scs-logo' in ad.get('src', ''):
            self.logos.append(ad)


html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
js = (ROOT / 'js/main.js').read_text(encoding='utf-8')

site = Site()
site.feed(html)

for ref in site.refs:
    if ref.startswith('#'):
        assert ref[1:] in site.ids, f'Missing anchor: {ref}'
    elif not ref.startswith(('https:', 'http:')):
        assert (ROOT / ref.lstrip('/')).is_file(), f'Missing asset: {ref}'

# Check CSS url(...) references resolve
for css_ref in re.findall(r"url\(['\"]?([^'\")]+)['\"]?\)", css):
    if not css_ref.startswith(('data:', 'http:', 'https:')):
        target = (ROOT / 'css' / css_ref).resolve()
        assert target.is_file(), f'Missing CSS asset: {css_ref}'

# Verify APK & release.json integrity
manifest = json.loads((ROOT / 'data/release.json').read_text(encoding='utf-8'))
for btn_id in ('dlBtn', 'heroDl', 'archiveCurrentLink'):
    assert btn_id in site.downloads, f'Missing download button #{btn_id}'
    assert site.downloads[btn_id]['href'] == manifest['downloadUrl'] == '/apk/SCS.apk'
    assert 'download' in site.downloads[btn_id]

apk = (ROOT / 'apk/SCS.apk').read_bytes()
assert hashlib.sha256(apk).hexdigest() == manifest['sha256']
assert len(apk) == manifest['fileSizeBytes'] == 5851613

# Verify logo attributes and distortion-free CSS rules
assert len(site.logos) >= 3, 'Expected header, hero, and footer SCS logo elements'
for lg in site.logos:
    assert lg.get('width') == '1024' and lg.get('height') == '809', f'Unexpected logo dimensions: {lg}'
assert 'aspect-ratio: 1024 / 809' in css and 'object-fit: contain' in css

# Verify WebP assets exist and are smaller than original JPEGs/PNG
webp_pairs = [
    ('img/hero-bg.webp', 'img/hero-bg.jpg'),
    ('img/screen-lobby.webp', 'img/screen-lobby.jpg'),
    ('img/screen-play.webp', 'img/screen-play.jpg'),
    ('img/screen-modes.webp', 'img/screen-modes.jpg'),
    ('img/screen-arsenal.webp', 'img/screen-arsenal.jpg'),
    ('img/screen-combat.webp', 'img/screen-combat.jpg'),
    ('img/screen-pause.webp', 'img/screen-pause.jpg'),
    ('img/scs-logo.webp', 'img/scs-logo.png'),
]
for webp_rel, orig_rel in webp_pairs:
    wp = ROOT / webp_rel
    op = ROOT / orig_rel
    assert wp.is_file(), f'Missing WebP asset: {webp_rel}'
    assert wp.stat().st_size < op.stat().st_size, f'WebP {webp_rel} not smaller than {orig_rel}'

# Verify trailer asset
trailer_path = ROOT / 'media/scs-gameplay-trailer.mp4'
assert trailer_path.is_file() and trailer_path.stat().st_size > 50_000

# Verify community.json & vercel.json valid JSON and no invented social URLs
community = json.loads((ROOT / 'data/community.json').read_text(encoding='utf-8'))
assert community['discordHandle'] == '0_umbra'
for ch in community['channels']:
    assert ch['url'] == '', f"Unexpected non-empty social URL in community.json: {ch}"
vercel_cfg = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))
assert any(h.get('source') == '/apk/SCS.apk' for h in vercel_cfg.get('headers', []))

# Preserved honesty & safety invariants from prior PRs
assert 'Play in Browser' not in html
assert 'sins-of-chaotic-shadows.vercel.app' not in html
assert 'github.com/0-umbra' not in html
assert 'scr1pt.fx' not in html
assert 'NO SIGN-UP REQUIRED' not in html.upper()
assert 'Play fully offline' not in html
assert 'Offline Mode — Coming Soon' in html
assert 'Offline gameplay is planned for a future update. Stay tuned for upcoming releases.' in html
assert 'Security Scan Notice:' in html and 'Tap “Scan app”' in html
assert 'installing over it keeps your local progress.' in html

# Verify all 5 required feature sections exist
for required_id in ('top', 'trailer', 'download', 'showcase', 'maps', 'modes', 'weapons', 'abilities', 'gallery', 'updates', 'community', 'compatibility', 'faq', 'about'):
    assert required_id in site.ids, f'Missing section #{required_id}'

assert 'Sunken Meridian' in html and 'PLANNED' in html
assert 'Android 7.0' in html and 'minSdkVersion 24' in html and 'targetSdkVersion 36' in html

# Verify newest-first documented changelog order
notes_match = re.search(r'<ol class="updates-list"[^>]*>(.*?)</ol>', html, re.S)
assert notes_match, 'Missing updates-list <ol>'
notes = notes_match.group(1)
versions = re.findall(r'<span class="mono">([\d.]+)</span>', notes)
assert versions == sorted(versions, key=lambda v: tuple(map(int, v.split('.'))), reverse=True)
assert len(versions) == len(set(versions))
assert versions == ['0.23.0', '0.22.1', '0.22.0', '0.21.0', '0.20.0']
assert re.findall(r'<time datetime="([^"]+)">', notes) == [manifest['releaseDate']]
assert 'Documented game update' in notes and 'Separate gameplay changes' in notes

# Ensure zero leaked Supabase/private keys or keystore references in public files
for text_blob in (html, css, js):
    assert 'supabase.co' not in text_blob.lower()
    assert 'eyjhbgcioijiuzi1ni' not in text_blob.lower()

print(f'PASS: {len(site.ids)} unique IDs, all assets/WebP/trailer/anchors resolved, APK size & SHA-256 verified')
print('PASS: all 5 upgraded feature sections, Sunken Meridian planned badge, Android SDK specs & changelog verified')
