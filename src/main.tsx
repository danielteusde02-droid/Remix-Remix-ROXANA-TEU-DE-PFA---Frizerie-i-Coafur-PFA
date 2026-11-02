import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear any obsolete service workers or caches if present
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().catch(() => {});
    }
  }).catch(() => {});
}

// Catch strictly identified masked cross-origin "Script error." events from external third-party widgets
// (Google Maps JS SDK / Cloudflare Turnstile) without hiding any real application JavaScript errors.
window.addEventListener(
  'error',
  (event: Event) => {
    // 1. Ignore DOM resource load events (<script onerror>, <img onerror>, <video onerror>)
    //    so element-level onerror handlers (such as Turnstile's script.onerror) always fire normally.
    if (!(event instanceof ErrorEvent)) {
      return;
    }

    // 2. Never suppress any error that carries a real Error instance / stack trace
    if (event.error != null) {
      return;
    }

    const filename = typeof event.filename === 'string' ? event.filename : '';

    const isMaskedCrossOriginScriptError =
      (event.message === 'Script error.' || event.message === 'Script error') &&
      filename === '' &&
      event.lineno === 0 &&
      event.colno === 0;

    const isGoogleMapsExternalScriptError =
      filename.includes('maps.googleapis.com') || filename.includes('maps.gstatic.com');

    const isTurnstileExternalScriptError =
      filename.includes('challenges.cloudflare.com');

    if (isGoogleMapsExternalScriptError) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('gmp-script-fallback'));
      return;
    }

    if (isTurnstileExternalScriptError) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('turnstile-script-error'));
      return;
    }

    if (isMaskedCrossOriginScriptError) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('gmp-script-fallback'));
    }
  },
  true
);

// Google Maps Platform Demo Key quota and auth error listener
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  window.dispatchEvent(new CustomEvent('gmp-script-fallback'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('InvalidKeyMapError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    window.dispatchEvent(new CustomEvent('gmp-script-fallback'));
    return;
  }
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);

