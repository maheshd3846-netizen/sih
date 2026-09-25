const { spawn } = require('child_process');

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--remote-debugging-port=9449', 'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const list = await fetch('http://127.0.0.1:9449/json/list').then(r => r.json());
  const pageTarget = list.find(p => p.type === 'page') || list[0];
  console.log('Selected target:', pageTarget.url, pageTarget.type);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id === 4) {
      console.log('DEBUG RES:', d.result);
    }
  };

  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://127.0.0.1:8080/' } }));
  await new Promise(r => setTimeout(r, 3000));

  ws.send(JSON.stringify({
    id: 4,
    method: 'Runtime.evaluate',
    params: { expression: 'JSON.stringify({ url: location.href, title: document.title, elem: Boolean(document.getElementById("val-domain-mean")), val: document.getElementById("val-domain-mean")?.textContent })' }
  }));

  await new Promise(r => setTimeout(r, 1500));
  chrome.kill();
}
test();
