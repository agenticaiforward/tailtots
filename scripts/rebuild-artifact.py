#!/usr/bin/env python3
"""Regenerate tailtots-finished-website artifact from a fresh `vinext build`.

Pipeline (static runtime forbids type="module"; sandbox blocks module loads):
  1. vinext build
  2. vinext start on a local port; curl / -> raw SSR HTML
  3. Rolldown-bundle dist/client/assets/index-*.js to ONE classic IIFE with
     inlineDynamicImports, neutralize __vite__mapDeps preloads, drop
     modulepreload <link>s, inline it as <script id="_R_">
  4. Rewrite root-relative asset URLs to relative (SSR HTML + bundle constants)
  5. Run this script's post-processing on the assembled index.html

Usage (after regenerating index.html + assets/):
  python3 scripts/rebuild-artifact.py <artifact-dir>
"""
import os, re, sys

ARTIFACT = sys.argv[1] if len(sys.argv) > 1 else \
    os.path.expanduser('~/workspace/ts-spaces/tailtots-finished-website')

def main():
    path = os.path.join(ARTIFACT, 'index.html')
    html = open(path, encoding='utf-8').read()

    # 1. Root-relative URLs -> relative (SSR HTML). The artifact is served from
    #    a sub-path, so /assets, /pets, /landing, /demo-faces would 404.
    rewrites = [
        ('/assets/', 'assets/'), ('/pets/', 'assets/pets/'),
        ('/landing/', 'assets/landing/'), ('/demo-faces/', 'assets/demo-faces/'),
        ('src="/favicon.svg"', 'src="assets/favicon.svg"'),
        ('src="/hero-kids-pets.png"', 'src="assets/hero-kids-pets.png"'),
        ('src="/tailtots-logo.png"', 'src="assets/tailtots-logo.png"'),
        ('href="/manifest.webmanifest"', 'href="assets/manifest.webmanifest"'),
        ('content="/%s/tailtots-logo.png"', 'og_meta'),
    ]
    html, made = apply_html_url_rewrites(html)

    # 2. Bundle constants also carry root-absolute paths (client-rendered
    #    <img>s after navigation). Rewrite inside the _R_ block.
    #    Boundary-aware: match ONLY at a quote/template/paren boundary, so
    #    '/demo-faces/pets/jack.jpg' does not get double-rewritten to
    #    'assets/demo-facesassets/pets/jack.jpg'.
    i = html.find('<script id="_R_">')
    if i != -1:
        j_open = html.find('>', i) + 1
        j_close = html.find('</script>', j_open)
        bundle = html[j_open:j_close]
        assert '</script' not in bundle, 'unexpected early close in bundle'
        bundle = re.sub(r'(["\'`(=\s])/assets/', r'\1assets/', bundle)
        bundle = re.sub(r'(["\'`(=\s])/demo-faces/', r'\1assets/demo-faces/', bundle)
        bundle = re.sub(r'(["\'`(=\s])/landing/', r'\1assets/landing/', bundle)
        bundle = re.sub(r'(["\'`(=\s])/pets/', r'\1assets/pets/', bundle)
        # occasionally the leading char is a template `${` or `(` without whitespace quirks:
        for abs_p, rel_p in []:
            bundle = bundle.replace(abs_p, rel_p)
        html = html[:j_open] + bundle + html[j_close:]

    # 3. _R_ must run AFTER the streamed RSC chunk scripts. Vinext's entry
    #    (oa()) falls back to fetching .rsc when __VINEXT_RSC_CHUNKS__ is
    #    absent; in a static file that fails and aborts hydration (reload
    #    once, then give up). Move _R_ to document end.
    i = html.find('<script id="_R_">')
    if i != -1:
        j = html.find('</script>', i) + len('</script>')
        r_script = html[i:j]
        rest = html[:i] + html[j:]
        done_tag = rest.rfind('<script>self.__VINEXT_RSC_DONE__=true</script>')
        if done_tag != -1 and i < done_tag:
            html = rest + r_script

    open(path, 'w', encoding='utf-8').write(html)
    print('post-processed', path, os.path.getsize(path), 'bytes')

def apply_html_url_rewrites(html):
    # og/meta tags embed the banner image with a path containing '%s'
    made = 0
    for a, b in [('/hero-kids-pets.png', 'assets/hero-kids-pets.png'),
                 ('/tailtots-logo.png', 'assets/tailtots-logo.png'),
                 ('/favicon.svg', 'assets/favicon.svg'),
                 ('/manifest.webmanifest', 'assets/manifest.webmanifest'),
                 ('"/assets/', '"assets/'),
                 ("'/assets/", "'assets/"),
                 ('("/assets/', '("assets/'),
                 ('/demo-faces/', 'assets/demo-faces/'),
                 ('/landing/', 'assets/landing/'),
                 ('/pets/', 'assets/pets/')]:
        c = html.count(a)
        made += c
        html = html.replace(a, b)
    return html, made

if __name__ == '__main__':
    main()
