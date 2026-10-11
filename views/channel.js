// WhatsApp channel button: a round WhatsApp logo bottom-left on every page that opens the
// channel in a new tab. The link is settings.whatsappChannelLink; the server writes it into `url`
// below when it sends this file (see /assets/channel.js in index.js).
(() => {
  if (window.__yannzChannel) return;
  window.__yannzChannel = true;
  const url = __CHANNEL_URL__;
  if (!url) return;

  const css = `
  .ych-btn{position:fixed;left:18px;bottom:18px;z-index:88;display:grid;place-items:center;width:50px;height:50px;padding:0;border:2px solid var(--edge,#d4d4d8);border-radius:50%;background:#111113;box-shadow:4px 4px 0 var(--drop,#3f3f46);transition:transform .15s,box-shadow .15s}
  .ych-btn:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--drop,#3f3f46)}
  .ych-btn:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--drop,#3f3f46)}
  .ych-btn:focus-visible{outline:2px solid #f4f4f5;outline-offset:3px}
  .ych-btn svg{width:26px;height:26px;fill:#25d366}
  @media (max-width:520px){.ych-btn{left:12px;bottom:12px;width:46px;height:46px}.ych-btn svg{width:24px;height:24px}}
  @media print{.ych-btn{display:none}}`;

  const mount = () => {
    if (document.querySelector('.ych-btn')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const a = document.createElement('a');
    a.className = 'ych-btn';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Saluran WhatsApp';
    a.setAttribute('aria-label', 'Saluran WhatsApp');
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.77 1.47h.01c6.25 0 11.34-5.08 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z"/></svg>';
    document.body.appendChild(a);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
