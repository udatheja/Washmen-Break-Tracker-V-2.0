import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const viteEntryHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Washmen — Wash & Fold Break Time Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

fs.writeFileSync('index.html', viteEntryHtml, 'utf8');
execSync('npx vite build', { stdio: 'inherit' });

const assetsDir = path.join('dist', 'assets');
const files = fs.readdirSync(assetsDir);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Missing compiled assets in dist/assets:', files);
  process.exit(1);
}

const cssContent = fs
  .readFileSync(path.join(assetsDir, cssFile), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/# sourceMappingURL=.*/g, '')
  .trim();

const jsContent = fs
  .readFileSync(path.join(assetsDir, jsFile), 'utf8')
  .replace(/\/\/# sourceMappingURL=.*/g, '')
  .trim();

const jsBase64 = Buffer.from(jsContent, 'utf8').toString('base64');
const buildVersion = Date.now().toString(36);

const singleFileHtml = `<!doctype html>
<html lang="en" data-build-version="${buildVersion}" data-system-architect="Udara Fernando" data-created-by="Created By Udara Fernando" data-developer-id="UF-WASHMEN-WF-2026">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#251B7C" />
    <meta name="author" content="Udara Fernando — Washmen Wash &amp; Fold Department" />
    <meta name="creator" content="Created By Udara Fernando" />
    <meta name="publisher" content="Udara Fernando (Washmen Laundry)" />
    <meta name="copyright" content="Created By Udara Fernando — Washmen Wash &amp; Fold Department" />
    <title>Washmen — Wash &amp; Fold Break Time Tracker</title>
    <meta name="description" content="Break time tracker and overtime governance dashboard for Washmen Laundry Wash &amp; Fold Department. Created By Udara Fernando." />
    <meta property="og:title" content="Washmen — Wash &amp; Fold Break Time Tracker" />
    <meta property="og:description" content="Break time tracker and overtime governance dashboard for Washmen Laundry Wash &amp; Fold Department. Created By Udara Fernando." />
    <meta property="og:type" content="website" />
    <style id="washmen-inline-css">${cssContent}</style>
    <script id="washmen-embedded-state" type="application/json">{}</script>
  </head>
  <body class="bg-[#F6F7FC] text-[#171262] antialiased selection:bg-[#4D3FDC] selection:text-white">
    <div id="root"></div>
    <script id="washmen-bundle-b64" type="text/plain">${jsBase64}</script>
    <script>
      (function() {
        try {
          if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              for (var i = 0; i < regs.length; i++) {
                regs[i].unregister();
              }
            }).catch(function(){});
          }
          if (typeof window !== "undefined" && "caches" in window) {
            window.caches.keys().then(function(keys) {
              for (var j = 0; j < keys.length; j++) {
                window.caches.delete(keys[j]);
              }
            }).catch(function(){});
          }
        } catch (e) {}

        window.__CREATOR_META__ = {
          name: "Udara Fernando",
          createdBy: "Created By Udara Fernando",
          title: "About the creator",
          department: "Wash & Fold Department",
          company: "Washmen Laundry",
          signature: "UF-WASHMEN-WF-2026"
        };

        window.__runEmbeddedApp = function() {
          if (window.__WASHMEN_APP_MOUNTED__) return;
          window.__WASHMEN_APP_MOUNTED__ = true;
          try {
            var b64El = document.getElementById("washmen-bundle-b64");
            if (!b64El) return;
            var b64 = b64El.textContent.trim();
            var binStr = window.atob(b64);
            var len = binStr.length;
            var bytes = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
              bytes[i] = binStr.charCodeAt(i);
            }
            var code = new TextDecoder("utf-8").decode(bytes);
            var s = document.createElement("script");
            s.setAttribute("data-washmen-runtime", "true");
            s.text = code;
            document.body.appendChild(s);
          } catch (err) {
            console.error("Failed to boot embedded bundle:", err);
          }
        };

        window.__runEmbeddedApp();
      })();
    </script>
  </body>
</html>`;

fs.writeFileSync('index.html', singleFileHtml, 'utf8');
fs.writeFileSync('washmen-break-tracker.html', singleFileHtml, 'utf8');
if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
fs.writeFileSync(path.join('public', 'washmen-break-tracker.html'), singleFileHtml, 'utf8');
fs.writeFileSync(path.join('dist', 'index.html'), singleFileHtml, 'utf8');
fs.writeFileSync(path.join('dist', 'washmen-break-tracker.html'), singleFileHtml, 'utf8');

console.log('Built self-contained single-file release successfully:', {
  buildVersion,
  cssBytes: cssContent.length,
  jsBase64Bytes: jsBase64.length,
});
