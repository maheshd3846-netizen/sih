const { spawn } = require('child_process');

async function testFull() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--remote-debugging-port=9477', 'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await fetch('http://127.0.0.1:9477/json/list').then(r => r.json());
    const pageTarget = list.find(p => p.type === 'page') || list[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    const runtimeErrors = [];
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        runtimeErrors.push(msg.params.exceptionDetails);
      }
    };

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        const handler = (evt) => {
          const d = JSON.parse(evt.data);
          if (d.id === reqId) {
            ws.removeEventListener('message', handler);
            resolve(d.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });
    await new Promise(r => setTimeout(r, 3000));

    async function evaluate(code) {
      const res = await send('Runtime.evaluate', { expression: `(() => { ${code} })()` });
      return res?.result?.value;
    }

    console.log('--- TEST 1: Initial state ---');
    const initRes = await evaluate(`
      return JSON.stringify({
        date: window.state.currentDate,
        points: window.state.currentGridData?.points?.length,
        layer: window.state.activeLayer,
        region: window.state.activeRegion,
        allDatesCount: window.state.allDates?.length
      });
    `);
    console.log('Init:', initRes);

    console.log('--- TEST 2: Step Next Day ---');
    await evaluate(`document.getElementById('btn-next-day').click();`);
    await new Promise(r => setTimeout(r, 1000));
    const nextDayRes = await evaluate(`return window.state.currentDate;`);
    console.log('Next Day Date:', nextDayRes);

    console.log('--- TEST 3: Switch Layer to Confidence ---');
    await evaluate(`
      const btn = document.querySelector('[data-layer="confidence"]');
      if (btn) btn.click();
      return window.state.activeLayer;
    `);
    const confRes = await evaluate(`return window.state.activeLayer;`);
    console.log('Active Layer after click:', confRes);

    console.log('--- TEST 4: Switch Layer to IMD ---');
    await evaluate(`
      const btn = document.querySelector('[data-layer="imd"]');
      if (btn) btn.click();
    `);
    const imdRes = await evaluate(`
      return JSON.stringify({
        activeLayer: window.state.activeLayer,
        bannerVisible: !document.getElementById('imd-mode-banner').classList.contains('hidden')
      });
    `);
    console.log('IMD Layer and Banner:', imdRes);

    console.log('--- TEST 5: Subregion Filter (Telangana) ---');
    await evaluate(`
      const btn = document.querySelector('.region-btn[data-region="Telangana"]');
      if (btn) btn.click();
    `);
    const regionRes = await evaluate(`
      return JSON.stringify({
        region: window.state.activeRegion,
        mean: document.getElementById('val-domain-mean')?.textContent
      });
    `);
    console.log('Region filter:', regionRes);

    console.log('--- TEST 6: Inspect Highest Disagreement Cell ---');
    await evaluate(`document.getElementById('btn-inspect-highest-d').click();`);
    await new Promise(r => setTimeout(r, 1200));
    const inspectRes = await evaluate(`
      const card = document.getElementById('panel-cell-inspector');
      return JSON.stringify({
        cardVisible: !card.classList.contains('hidden'),
        selectedPoint: window.state.selectedPoint ? {
          lat: window.state.selectedPoint.lat,
          lon: window.state.selectedPoint.lon,
          fused: window.state.selectedPoint.fused_mm,
          d: window.state.selectedPoint.disagreement_mm,
          conf: window.state.selectedPoint.confidence_class
        } : null,
        coordsText: document.getElementById('inspect-coords')?.textContent,
        fusedVal: document.getElementById('inspect-fused-val')?.textContent,
        gfsVal: document.getElementById('inspect-gfs-val')?.textContent,
        ecmwfVal: document.getElementById('inspect-ecmwf-val')?.textContent
      });
    `);
    console.log('Cell Inspector:', inspectRes);

    console.log('--- TEST 7: 3D Viewport Switch ---');
    await evaluate(`document.getElementById('btn-view-3d').click();`);
    await new Promise(r => setTimeout(r, 1000));
    const threeDRes = await evaluate(`
      return JSON.stringify({
        dimension: window.state.viewDimension,
        threeContainerVisible: !document.getElementById('three-container').classList.contains('hidden'),
        cluster3DVisible: !document.getElementById('cluster-3d-layers').classList.contains('hidden')
      });
    `);
    console.log('3D View Switch:', threeDRes);

    console.log('--- TEST 8: 3D Mode Switch (Disagreement) ---');
    await evaluate(`document.getElementById('btn-3d-disagreement').click();`);
    const threeModeRes = await evaluate(`return window.state.threeMode;`);
    console.log('3D Mode:', threeModeRes);

    console.log('--- TEST 9: Switch back to 2D ---');
    await evaluate(`document.getElementById('btn-view-2d').click();`);
    const twoDRes = await evaluate(`return window.state.viewDimension;`);
    console.log('Dimension back to 2D:', twoDRes);

    console.log('--- TEST 10: Switch Views (Verification & Methodology tabs) ---');
    await evaluate(`document.querySelector('.nav-tab[data-view="verification"]').click();`);
    await new Promise(r => setTimeout(r, 500));
    const verifRes = await evaluate(`
      return JSON.stringify({
        activeView: window.state.activeView,
        viewActive: document.getElementById('view-verification').classList.contains('active'),
        tableRowsCount: document.querySelectorAll('#tbody-period-metrics tr').length
      });
    `);
    console.log('Verification Tab:', verifRes);

    await evaluate(`document.querySelector('.nav-tab[data-view="methodology"]').click();`);
    await new Promise(r => setTimeout(r, 500));
    const methRes = await evaluate(`
      return JSON.stringify({
        activeView: window.state.activeView,
        viewActive: document.getElementById('view-methodology').classList.contains('active')
      });
    `);
    console.log('Methodology Tab:', methRes);

    await evaluate(`document.querySelector('.nav-tab[data-view="forecast"]').click();`);
    await new Promise(r => setTimeout(r, 500));

    console.log('--- TEST 11: Demo Tour Modal ---');
    await evaluate(`document.getElementById('btn-start-demo').click();`);
    const demoOpen = await evaluate(`return !document.getElementById('demo-overlay').classList.contains('hidden');`);
    await evaluate(`document.getElementById('btn-demo-next').click();`);
    const demoStep2 = await evaluate(`return window.state.demoStep;`);
    await evaluate(`document.getElementById('btn-close-demo').click();`);
    const demoClosed = await evaluate(`return document.getElementById('demo-overlay').classList.contains('hidden');`);
    console.log('Demo Tour:', { demoOpen, demoStep2, demoClosed });

    console.log('--- CHECK RUNTIME ERRORS ---');
    console.log('Total runtime errors during entire session:', runtimeErrors.length);
    if (runtimeErrors.length > 0) {
      console.log('Errors:', JSON.stringify(runtimeErrors, null, 2));
    }

    ws.close();
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    chrome.kill();
  }
}

testFull();
