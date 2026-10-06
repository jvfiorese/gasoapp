# Gera dist/gasoapp.html (fragmento para Artifact) e dist/index.html (documento completo para instalar no iPhone).
import pathlib
b = pathlib.Path(__file__).parent
app = (b/"src/app.html").read_text()
app = app.replace("/*FONTES*/", (b/"src/fontes.js").read_text()).replace("/*MOTOR*/", (b/"src/motor.js").read_text())
d = b/"dist"; d.mkdir(exist_ok=True)
(d/"gasoapp.html").write_text(app)
head = '''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Gasoapp"><meta name="theme-color" content="#1b5e8c">
<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icone-180.png"><link rel="icon" href="icone-192.png"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head><body>
'''
sw_reg = '<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");</script>'
site = b/"site"; site.mkdir(exist_ok=True)
(d/"index.html").write_text(head + app + "\n</body></html>\n")
(site/"index.html").write_text(head + app + "\n" + sw_reg + "\n</body></html>\n")
import hashlib
versao = hashlib.sha1(app.encode()).hexdigest()[:10]
(site/"sw.js").write_text((b/"src/sw.js").read_text().replace("__VERSAO__", versao))
(site/"manifest.webmanifest").write_text((b/"src/manifest.webmanifest").read_text())
print("site versao", versao)
print("ok", len(app))
