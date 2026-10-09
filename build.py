"""Builds dist/index.html for publishing Triple T as a claude.ai Artifact.

The Artifact host wraps the page in its own <html>/<head>/<body> skeleton (with charset and
viewport metas), so the published page is index.html's head contents plus its body contents.
The JS, CSS and music are published alongside it as separate files.
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
head = re.search(r'<head>(.*)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
head = re.sub(r'\s*<meta [^>]*>', '', head).strip()
music = '<script>window.TRIPLE_T_MUSIC = "sound/chase.mp3";</script>'

out = root / 'dist'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(f'{head}\n{music}\n{body.strip()}\n')
print(f'wrote {out / "index.html"}')
