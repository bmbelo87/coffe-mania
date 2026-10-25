import { renderLoginPage, renderSessionError } from './auth/LoginPage';
import { loadOperationStatus, resolveSession } from './game/session';

/** Páginas do acesso (convite, senha, conta, documentos); o resto cai na entrada. */
const ACCESS_PATHS = ['/convite', '/lista/confirmar', '/senha', '/conta', '/termos', '/privacidade', '/conduta'];

async function start(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app não encontrado');
  const playing = window.location.pathname === '/play' || window.location.pathname === '/play/';
  document.body.classList.add('auth-page');
  host.innerHTML = '<p class="auth-check" role="status">Verificando sessão…</p>';
  try {
    const [session, status] = await Promise.all([resolveSession(), loadOperationStatus()]);
    if (playing) {
      // The server already redirects /play while locked; this covers a page restored from cache.
      if (!session || status?.active && !session.staff) {
        const room = new URLSearchParams(window.location.search).get('room');
        window.location.replace(room ? '/?room=' + encodeURIComponent(room) : '/');
        return;
      }
      const { prepareCafeEntry } = await import('./auth/CafeNameScreen');
      await prepareCafeEntry(host);
      document.body.classList.remove('auth-page');
      host.replaceChildren();
      await import('./play');
      const checkAccess = async () => {
        if (document.hidden) return;
        try {
          if (!await resolveSession()) window.location.replace('/');
        } catch { /* Uma falha de rede temporária não encerra uma sessão válida. */ }
      };
      window.addEventListener('pageshow', () => { void checkAccess(); });
      document.addEventListener('visibilitychange', () => { void checkAccess(); });
      window.addEventListener('storage', (event) => {
        if (event.key === 'coffe-auth-change') void checkAccess();
      });
    } else if (window.location.pathname.replace(/\/$/, '') === '/admin/metricas') {
      const { renderMetricsPage } = await import('./admin/MetricsPage');
      await renderMetricsPage(host, session);
    } else if (ACCESS_PATHS.includes(window.location.pathname.replace(/\/$/, ''))) {
      const { renderAccessPage } = await import('./auth/AccessPages');
      await renderAccessPage(host, window.location.pathname.replace(/\/$/, ''), session);
    } else {
      renderLoginPage(host, session, status);
    }
  } catch (error) {
    document.body.classList.remove('cafe-name-page');
    document.body.classList.add('auth-page');
    renderSessionError(host, error);
  }
}

void start();
