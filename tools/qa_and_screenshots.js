const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function run() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9555;
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    '--window-size=1366,768',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const outDir = path.join(__dirname, '../results/screenshots/after');
  fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors = [];

  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const pages = await listRes.json();
    const pageTarget = pages.find(p => p.type === 'page') || pages[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

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

    ws.addEventListener('message', (evt) => {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(data.params.exceptionDetails);
      }
      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');

    async function setViewport(w, h) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: false
      });
      await send('Runtime.evaluate', { expression: 'if (window.state && window.state.map) window.state.map.invalidateSize()' });
      await new Promise(r => setTimeout(r, 400));
    }

    async function waitForCondition(expr, timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const res = await send('Runtime.evaluate', { expression: expr });
        if (res.result && res.result.value) return true;
        await new Promise(r => setTimeout(r, 250));
      }
      return false;
    }

    async function capture(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(shot.data, 'base64');
      const target = path.join(outDir, filename);
      fs.writeFileSync(target, buffer);
      console.log('Saved screenshot:', filename, `(${buffer.length} bytes)`);
    }

    // ==========================================
    // VIEWPORT 1: 1366 x 768
    // ==========================================
    console.log('=== CAPTURING AT 1366x768 ===');
    await setViewport(1366, 768);
    await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });

    // Wait for grid data to load
    await waitForCondition('Boolean(document.getElementById("val-domain-mean") && document.getElementById("val-domain-mean").textContent !== "--")');
    await new Promise(r => setTimeout(r, 1200));

    // 1. Main Forecast Screen (1366x768)
    await capture('01_main_forecast_1366x768.png');

    // 2. Confidence Layer (1366x768)
    await send('Runtime.evaluate', { expression: 'document.getElementById("layer-btn-confidence").click()' });
    await new Promise(r => setTimeout(r, 700));
    await capture('02_confidence_layer_1366x768.png');

    // 3. Selected Cell Inspector (Peak Rain Cell) (1366x768)
    await send('Runtime.evaluate', { expression: 'document.getElementById("btn-inspect-peak-rain").click()' });
    await new Promise(r => setTimeout(r, 1200));
    await capture('03_cell_inspector_1366x768.png');

    // 4. IMD Retrospective Verification Mode (1366x768)
    await send('Runtime.evaluate', { expression: 'document.getElementById("layer-btn-imd").click()' });
    await new Promise(r => setTimeout(r, 700));
    await capture('04_imd_verification_mode_1366x768.png');

    // 5. Verification Tab (1366x768)
    await send('Runtime.evaluate', { expression: 'document.getElementById("tab-verification").click()' });
    await new Promise(r => setTimeout(r, 700));
    await capture('05_verification_tab_1366x768.png');

    // Return to forecast tab & fused layer
    await send('Runtime.evaluate', { expression: 'document.getElementById("tab-forecast").click()' });
    await send('Runtime.evaluate', { expression: 'document.getElementById("layer-btn-fused").click()' });
    await send('Runtime.evaluate', { expression: 'document.getElementById("btn-close-inspector").click()' });
    await new Promise(r => setTimeout(r, 500));

    // ==========================================
    // VIEWPORT 2: 1440 x 900
    // ==========================================
    console.log('=== CAPTURING AT 1440x900 ===');
    await setViewport(1440, 900);
    await new Promise(r => setTimeout(r, 800));
    await capture('06_main_forecast_1440x900.png');

    // Inspect Highest Disagreement Cell at 1440x900
    await send('Runtime.evaluate', { expression: 'document.getElementById("btn-inspect-highest-d").click()' });
    await new Promise(r => setTimeout(r, 1200));
    await capture('07_cell_inspector_1440x900.png');

    await send('Runtime.evaluate', { expression: 'document.getElementById("btn-close-inspector").click()' });

    // ==========================================
    // VIEWPORT 3: 1920 x 1080
    // ==========================================
    console.log('=== CAPTURING AT 1920x1080 ===');
    await setViewport(1920, 1080);
    await new Promise(r => setTimeout(r, 800));
    await capture('08_main_forecast_1920x1080.png');

    // Inspect at 1920x1080
    await send('Runtime.evaluate', { expression: 'document.getElementById("btn-inspect-peak-rain").click()' });
    await new Promise(r => setTimeout(r, 1200));
    await capture('09_cell_inspector_1920x1080.png');

    ws.close();
  } finally {
    chrome.kill();
  }

  console.log('=== BROWSER QA ERROR CHECK ===');
  console.log(`Total Unhandled JavaScript Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Errors:', JSON.stringify(consoleErrors, null, 2));
  } else {
    console.log('QA SUCCESS: 0 unhandled JavaScript errors verified.');
  }
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
