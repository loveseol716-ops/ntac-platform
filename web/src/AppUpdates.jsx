import { useEffect, useState } from 'react';

export default function AppUpdates() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let registration, disposed = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    const changed = () => { if (hadController && !disposed) setAvailable(true); hadController = true; };
    const preloadFailed = event => { event.preventDefault(); setAvailable(true); };
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible')
        registration?.update().catch(() => {});
    };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    window.addEventListener('vite:preloadError', preloadFailed);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then(value => { registration = value; if (!disposed) check(); })
      .catch(() => {});
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      disposed = true;
      clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      window.removeEventListener('vite:preloadError', preloadFailed);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return available ? <aside className="app-update-notice" role="status">
    <div><strong>새 버전이 준비됐어요</strong><span>작성 중인 내용을 저장한 뒤 적용해 주세요.</span></div>
    <button onClick={() => window.location.reload()}>새 화면 적용</button>
  </aside> : null;
}
