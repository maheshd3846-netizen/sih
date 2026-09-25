const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9222;
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1366,768',
    'about:blank'
  ]);

  // wait 1.5s for Chrome to start
  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === reqId) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://127.0.0.1:8080/ ...');
    await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });

    // Wait until window.state && window.state.currentGridData
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: 'Boolean(window.state && window.state.currentGridData && window.state.currentGridData.points && window.state.currentGridData.points.length > 0)'
      });
      if (res.result && res.result.value) {
        console.log('Grid data loaded successfully!');
        break;
      }
    }

    // Wait another 1s for Leaflet rendering
    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const outPath = path.join(__dirname, '../results/screenshots/before/forecast_1366x768_loaded.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
    console.log('Saved screenshot to:', outPath);

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
