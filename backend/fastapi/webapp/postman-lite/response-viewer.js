// response-viewer.js - render response with meta & tabs
(function(global){
  function formatBytes(bytes){
    if(bytes === 0 || bytes == null) return '0 B';
    const k = 1024; const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes)/Math.log(k));
    return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+sizes[i];
  }
  function prettyJSON(text){
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
  }
  function setActive(tabId){
    document.querySelectorAll('#responseTabs .resp-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.response-area').forEach(a=>a.style.display='none');
    document.querySelector(`#responseTabs .resp-tab[data-rtab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).style.display='block';
  }
  function render({ status, timeMs, sizeBytes, headers, body, contentType }){
    document.getElementById('respStatusCode').textContent = `Status: ${status}`;
    document.getElementById('respTime').textContent = `Time: ${timeMs} ms`;
    document.getElementById('respSize').textContent = `Size: ${formatBytes(sizeBytes)}`;
    // Headers
    const headersEl = document.getElementById('responseHeaders');
    headersEl.textContent = Object.entries(headers||{}).map(([k,v])=>`${k}: ${v}`).join('\n');
    // Raw
    document.getElementById('responseRaw').textContent = body;
    // Body Pretty/Preview
    const bodyEl = document.getElementById('responseBody');
    const previewEl = document.getElementById('responsePreview');
    const ct = (contentType||'').toLowerCase();
    if(ct.includes('application/json')){
      bodyEl.textContent = prettyJSON(body);
    } else if(ct.includes('text/') || ct.includes('application/xml') || ct.includes('html')){
      bodyEl.textContent = body;
    } else {
      bodyEl.textContent = '[binary data]';
    }
    if(ct.includes('html')){
      // Render in sandboxed iframe to avoid executing scripts from response HTML
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', '');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      // Ensure container is clean
      previewEl.innerHTML = '';
      previewEl.appendChild(iframe);
      try {
        // Use srcdoc for modern browsers
        iframe.srcdoc = body;
      } catch {
        // Fallback: write into iframe document
        const doc = iframe.contentWindow && iframe.contentWindow.document;
        if (doc) { doc.open(); doc.write(body); doc.close(); }
      }
    } else if(ct.includes('image/')){
      try {
        const blob = new Blob([body]);
        previewEl.innerHTML = `<img alt="image" style="max-width:100%" src="${URL.createObjectURL(blob)}">`;
      } catch {
        previewEl.textContent = 'Preview not available';
      }
    } else {
      previewEl.textContent = 'Preview not available';
    }
    setActive('responseBody');
  }
  function getBodyText(){
    const el = document.getElementById('responseBody');
    return el ? el.textContent : '';
  }
  global.ResponseViewer = { render, setActive, getBodyText };
})(window);
