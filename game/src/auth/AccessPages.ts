import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './login.css';
import './access.css';

import { logoutEverywhere, type PlayerSession } from '../game/session';
import { accessApi, loadAccessConfig, takeFragmentSecret } from './access-api';
import { checked, errorMessage, handleSubmit, text } from './forms';
import { landingFooter } from './LandingPage';
import { LEGAL_DOCS, LEGAL_PATHS, LEGAL_VERSION, type LegalDocId } from './legal';
import { mountTurnstile } from './turnstile';

function card(host: HTMLElement, title: string): { content: HTMLElement; error: HTMLElement } {
  document.body.classList.add('auth-page');
  host.innerHTML = `
    <main class="login-card">
      <a class="login-home" href="/"><img src="/assets/ui/logo/cafe-mania.png" alt="Café Mania" width="957" height="510"></a>
      <h1></h1>
      <div class="login-content"></div>
      <p class="login-error" role="alert" aria-live="polite"></p>
    </main>`;
  host.querySelector('h1')!.textContent = title;
  return { content: host.querySelector<HTMLElement>('.login-content')!, error: host.querySelector<HTMLElement>('.login-error')! };
}

function message(content: HTMLElement, title: string, body: string, link?: { href: string; label: string }): void {
  content.innerHTML = '<p class="login-status-title"></p><p class="login-subtitle"></p>';
  content.querySelector('.login-status-title')!.textContent = title;
  content.querySelector('.login-subtitle')!.textContent = body;
  if (link) {
    const anchor = document.createElement('a');
    anchor.className = 'login-primary';
    anchor.href = link.href;
    anchor.textContent = link.label;
    content.append(anchor);
  }
}

/** Telas do acesso fora do jogo: convite, confirmação da lista, senha, conta e documentos. */
export async function renderAccessPage(host: HTMLElement, path: string, session: PlayerSession | null): Promise<void> {
  // A link opened in the same tab (e.g. "/senha" → "/senha#token") only changes the fragment.
  window.addEventListener('hashchange', () => { if (window.location.hash.length > 1) window.location.reload(); });
  const legal = (Object.entries(LEGAL_PATHS) as [LegalDocId, string][]).find(([, value]) => value === path);
  if (legal) return renderLegal(host, legal[0]);
  if (path === '/convite') return renderSignup(host);
  if (path === '/lista/confirmar') return renderConfirm(host);
  if (path === '/senha') return renderPassword(host);
  if (path === '/conta') return session ? renderAccount(host, session) : window.location.replace('/?entrar');
}

async function renderConfirm(host: HTMLElement): Promise<void> {
  const { content, error } = card(host, 'Lista de espera');
  const token = takeFragmentSecret();
  content.innerHTML = '<p class="login-subtitle">Confirmando…</p>';
  try {
    const { position } = await accessApi.confirmWaitlist(token);
    message(content, 'Vaga confirmada!', `Você é o número ${position} da fila. Avisaremos por email quando o seu convite sair.`, { href: '/', label: 'Voltar ao início' });
  } catch (reason) {
    content.innerHTML = '';
    error.textContent = errorMessage(reason);
    message(content, 'Não deu certo', 'Se o link venceu, entre na lista de novo para receber outro.', { href: '/', label: 'Ir para a lista de espera' });
  }
}

async function renderSignup(host: HTMLElement): Promise<void> {
  const { content, error } = card(host, 'Seu convite');
  const code = takeFragmentSecret();
  content.innerHTML = '<p class="login-subtitle">Conferindo o convite…</p>';
  let invite: { email: string; expiresAt: number };
  try {
    invite = await accessApi.checkInvite(code);
  } catch (reason) {
    error.textContent = errorMessage(reason);
    message(content, 'Convite indisponível', 'Peça um convite novo entrando na lista de espera. Se você já tem conta, é só entrar.', { href: '/', label: 'Ir para o início' });
    return;
  }
  content.innerHTML = `
    <p class="login-subtitle">Crie a sua conta para abrir o seu café.</p>
    <form class="login-form">
      <label for="signup-email">Email</label>
      <input id="signup-email" type="email" autocomplete="username" readonly>
      <label for="signup-name">Nome no jogo</label>
      <input id="signup-name" name="name" autocomplete="nickname" minlength="3" maxlength="24" required>
      <label for="signup-password">Senha <span class="login-optional">(mínimo de 8 caracteres)</span></label>
      <input id="signup-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
      <label for="signup-confirm">Confirme a senha</label>
      <input id="signup-confirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required>
      <p class="login-status-note">Alpha: o progresso será apagado quando o beta chegar. Você fica com o selo de Fundador.</p>
      <label class="login-check"><input type="checkbox" name="adult" required> <span>Tenho 18 anos ou mais.</span></label>
      <label class="login-check"><input type="checkbox" name="terms" required> <span>Li e aceito os <a href="${LEGAL_PATHS.termos}" target="_blank" rel="noopener">Termos de Uso</a>, a <a href="${LEGAL_PATHS.privacidade}" target="_blank" rel="noopener">Política de Privacidade</a> e o <a href="${LEGAL_PATHS.conduta}" target="_blank" rel="noopener">Código de Conduta</a>.</span></label>
      <button class="login-primary" type="submit">Criar conta e jogar</button>
    </form>`;
  content.querySelector<HTMLInputElement>('#signup-email')!.value = invite.email;
  handleSubmit(content.querySelector('form')!, error, 'Criando…', async (data) => {
    await accessApi.signup({
      code, name: text(data, 'name'), password: text(data, 'password'), passwordConfirm: text(data, 'passwordConfirm'),
      adult: checked(data, 'adult'), terms: checked(data, 'terms'),
    });
    try { localStorage.setItem('coffe-auth-change', String(Date.now())); } catch { /* Storage opcional. */ }
    window.location.assign('/play');
  });
}

async function renderPassword(host: HTMLElement): Promise<void> {
  const token = takeFragmentSecret();
  const { content, error } = card(host, token ? 'Nova senha' : 'Esqueci minha senha');
  if (token) {
    content.innerHTML = `
      <p class="login-subtitle">Escolha a nova senha. Você sairá de todos os aparelhos.</p>
      <form class="login-form">
        <label for="reset-password">Nova senha <span class="login-optional">(mínimo de 8 caracteres)</span></label>
        <input id="reset-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
        <label for="reset-confirm">Confirme a nova senha</label>
        <input id="reset-confirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required>
        <button class="login-primary" type="submit">Trocar senha</button>
      </form>`;
    handleSubmit(content.querySelector('form')!, error, 'Trocando…', async (data) => {
      await accessApi.resetPassword(token, text(data, 'password'), text(data, 'passwordConfirm'));
      message(content, 'Senha trocada!', 'Agora é só entrar com a senha nova.', { href: '/?entrar', label: 'Entrar' });
    });
    return;
  }
  content.innerHTML = `
    <p class="login-subtitle">Informe o email da sua conta. Se ela existir, enviaremos um link para criar uma senha nova.</p>
    <form class="login-form">
      <label for="forgot-email">Email</label>
      <input id="forgot-email" name="email" type="email" autocomplete="username" required>
      <div class="login-turnstile"></div>
      <button class="login-primary" type="submit">Enviar link</button>
    </form>
    <a class="login-link" href="/?entrar">Voltar para a entrada</a>`;
  const form = content.querySelector('form')!;
  const widget = loadAccessConfig().then((config) => mountTurnstile(form.querySelector('.login-turnstile')!, config.turnstileSiteKey));
  handleSubmit(form, error, 'Enviando…', async (data) => {
    const turnstile = await widget;
    try { await accessApi.forgotPassword(text(data, 'email').trim(), turnstile.token()); } catch (reason) { turnstile.reset(); throw reason; }
    message(content, 'Confira o seu email', 'Se existir uma conta com esse email, o link chega em instantes. Ele vale por pouco tempo e funciona uma vez.', { href: '/?entrar', label: 'Voltar para a entrada' });
  });
}

function renderAccount(host: HTMLElement, session: PlayerSession): void {
  const { content, error } = card(host, 'Minha conta');
  content.innerHTML = `
    <p class="login-welcome"></p>
    <section class="account-section">
      <h2>Trocar senha</h2>
      <form class="login-form" data-form="password">
        <label for="account-current">Senha atual</label>
        <input id="account-current" name="current" type="password" autocomplete="current-password" required>
        <label for="account-new">Nova senha</label>
        <input id="account-new" name="password" type="password" autocomplete="new-password" minlength="8" required>
        <label for="account-confirm">Confirme a nova senha</label>
        <input id="account-confirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required>
        <button class="login-secondary" type="submit">Trocar senha</button>
      </form>
    </section>
    <section class="account-section">
      <h2>Meus dados</h2>
      <p class="login-note">Baixe uma cópia de tudo o que o jogo guarda sobre você.</p>
      <a class="login-secondary" href="/api/coffe/account/export" download>Baixar meus dados</a>
      <button class="login-secondary" type="button" data-action="logout-all">Sair de todos os aparelhos</button>
    </section>
    <section class="account-section account-danger">
      <h2>Excluir conta</h2>
      <p class="login-note">Apaga a conta, o café e todo o progresso. Não dá para desfazer.</p>
      <form class="login-form" data-form="delete">
        <label for="account-delete-password">Senha</label>
        <input id="account-delete-password" name="password" type="password" autocomplete="current-password" required>
        <label class="login-check"><input type="checkbox" name="confirm" required> <span>Entendo que tudo será apagado.</span></label>
        <button class="login-danger" type="submit">Excluir minha conta</button>
      </form>
    </section>
    <a class="login-link" href="/">Voltar</a>`;
  content.querySelector('.login-welcome')!.textContent = `${session.displayName} · ${session.email}`;
  const passwordForm = content.querySelector<HTMLFormElement>('[data-form="password"]')!;
  handleSubmit(passwordForm, error, 'Trocando…', async (data) => {
    await accessApi.changePassword(text(data, 'current'), text(data, 'password'), text(data, 'passwordConfirm'));
    passwordForm.reset();
    error.textContent = 'Senha trocada. Os outros aparelhos foram desconectados.';
  });
  const logoutAll = content.querySelector<HTMLButtonElement>('[data-action="logout-all"]')!;
  logoutAll.addEventListener('click', async () => {
    logoutAll.disabled = true;
    try { await logoutEverywhere(); window.location.assign('/?entrar'); } catch (reason) { error.textContent = errorMessage(reason); logoutAll.disabled = false; }
  });
  handleSubmit(content.querySelector<HTMLFormElement>('[data-form="delete"]')!, error, 'Excluindo…', async (data) => {
    await accessApi.deleteAccount(text(data, 'password'));
    try { localStorage.setItem('coffe-auth-change', String(Date.now())); } catch { /* Storage opcional. */ }
    message(content, 'Conta excluída', 'Obrigado por ter jogado. Se quiser voltar, a lista de espera continua aberta.', { href: '/', label: 'Ir para o início' });
  });
}

async function renderLegal(host: HTMLElement, id: LegalDocId): Promise<void> {
  document.body.classList.add('auth-page');
  const doc = LEGAL_DOCS[id];
  const config = await loadAccessConfig();
  const contact = config.contactEmail || 'o email de contato publicado nesta página antes da abertura';
  host.innerHTML = `
    <main class="legal-card">
      <a class="login-home" href="/"><img src="/assets/ui/logo/cafe-mania.png" alt="Café Mania" width="957" height="510"></a>
      <nav class="legal-nav" aria-label="Documentos"></nav>
      <h1></h1>
      <p class="legal-version"></p>
      <p class="legal-intro"></p>
    </main>`;
  const main = host.querySelector<HTMLElement>('.legal-card')!;
  const nav = main.querySelector('.legal-nav')!;
  for (const [other, href] of Object.entries(LEGAL_PATHS) as [LegalDocId, string][]) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = LEGAL_DOCS[other].title;
    if (other === id) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  main.querySelector('h1')!.textContent = doc.title;
  main.querySelector('.legal-version')!.textContent = `Versão de ${LEGAL_VERSION.split('-').reverse().join('/')}`;
  main.querySelector('.legal-intro')!.textContent = doc.intro;
  for (const section of doc.sections) {
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    main.append(heading);
    for (const paragraph of section.paragraphs) {
      const p = document.createElement('p');
      p.textContent = paragraph.replaceAll('{contato}', contact);
      main.append(p);
    }
  }
  document.title = `${doc.title} · Café Mania`;
  host.append(landingFooter());
}
