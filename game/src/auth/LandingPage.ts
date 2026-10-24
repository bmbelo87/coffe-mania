import './access.css';

import { accessApi, loadAccessConfig } from './access-api';
import { checked, handleSubmit, mountLoginForm, text } from './forms';
import { LEGAL_PATHS } from './legal';
import { mountTurnstile } from './turnstile';

const SHOTS = [
  { file: 'cafe.jpg', caption: 'Receba os clientes e sirva os pratos' },
  { file: 'loja.jpg', caption: 'Monte e decore o seu café' },
  { file: 'orla.jpg', caption: 'Na orla da cidade, de frente para a praia' },
];

export function landingFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'landing-footer';
  footer.innerHTML = `
    <p>Café Mania é um projeto de fãs, sem fins lucrativos e sem vínculo com a Vostu ou com os detentores dos direitos do jogo original.</p>
    <nav aria-label="Documentos">
      <a href="${LEGAL_PATHS.termos}">Termos de Uso</a>
      <a href="${LEGAL_PATHS.privacidade}">Privacidade</a>
      <a href="${LEGAL_PATHS.conduta}">Código de Conduta</a>
    </nav>`;
  return footer;
}

/**
 * Página de quem ainda não entrou: a história do projeto, imagens do jogo e o cartão com a
 * lista de espera e o login. O jogo em si só abre para contas criadas por convite.
 */
export function renderLanding(host: HTMLElement): void {
  document.body.classList.remove('auth-page');
  document.body.classList.add('landing-page');
  host.innerHTML = `
    <div class="landing">
      <header class="landing-hero">
        <img class="landing-logo" src="/assets/ui/logo/cafe-mania.png" alt="Café Mania" width="957" height="510">
        <p class="landing-tagline">O café da época do Orkut está voltando, feito por fãs.</p>
        <span class="landing-badge">Alpha fechado · só para convidados</span>
      </header>
      <main class="landing-main">
        <section class="landing-story">
          <h2>De volta ao balcão</h2>
          <p>Lembra de abrir o Café Mania entre um scrap e outro, colocar os fogões para trabalhar e voltar correndo antes da comida estragar? Um grupo de fãs está reconstruindo o jogo, peça por peça, a partir de capturas, vídeos e da memória de quem jogou.</p>
          <p>O alpha fechado é a primeira vez que o café abre as portas para outras pessoas. É de graça, sem anúncios e sem nada à venda.</p>
          <div class="landing-shots"></div>
          <h3>Como entrar</h3>
          <ol class="landing-steps">
            <li>Entre na lista de espera e confirme o seu email.</li>
            <li>Os convites saem em ondas pequenas, por ordem de confirmação.</li>
            <li>Quem joga o alpha ganha o selo de <strong>Fundador</strong>, que continua com você quando o progresso for apagado no beta.</li>
          </ol>
        </section>
        <aside class="landing-card login-card">
          <div class="landing-tabs" role="tablist">
            <button type="button" role="tab" data-tab="waitlist">Lista de espera</button>
            <button type="button" role="tab" data-tab="login">Entrar</button>
          </div>
          <div class="login-content"></div>
          <p class="login-error" role="alert" aria-live="polite"></p>
        </aside>
      </main>
    </div>`;
  const shots = host.querySelector<HTMLElement>('.landing-shots')!;
  for (const shot of SHOTS) {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = '/assets/landing/' + shot.file;
    image.alt = shot.caption;
    image.loading = 'lazy';
    image.width = 640; image.height = 360;
    const caption = document.createElement('figcaption');
    caption.textContent = shot.caption;
    figure.append(image, caption);
    shots.append(figure);
  }
  host.querySelector('.landing')!.append(landingFooter());

  const content = host.querySelector<HTMLElement>('.landing-card .login-content')!;
  const error = host.querySelector<HTMLElement>('.landing-card .login-error')!;
  const tabs = [...host.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const select = (tab: string) => {
    error.textContent = '';
    for (const button of tabs) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    if (tab === 'login') mountLoginForm(content, error);
    else mountWaitlist(content, error);
  };
  for (const button of tabs) button.addEventListener('click', () => select(button.dataset.tab!));
  const params = new URLSearchParams(window.location.search);
  select(params.has('room') || params.has('entrar') ? 'login' : 'waitlist');
}

function mountWaitlist(content: HTMLElement, error: HTMLElement): void {
  content.innerHTML = `
    <p class="login-subtitle">Peça o seu convite para o alpha.</p>
    <form class="login-form">
      <label for="wait-name">Seu nome</label>
      <input id="wait-name" name="name" autocomplete="name" maxlength="60" required>
      <label for="wait-email">Email</label>
      <input id="wait-email" name="email" type="email" autocomplete="email" required>
      <label for="wait-memory">Como você jogava o Café Mania? <span class="login-optional">(opcional)</span></label>
      <textarea id="wait-memory" name="memory" maxlength="500" rows="3" placeholder="Seu prato favorito, o nome do seu café, com quem você jogava…"></textarea>
      <div class="login-trap" aria-hidden="true"><label>Site <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label class="login-check"><input type="checkbox" name="adult" required> <span>Tenho 18 anos ou mais.</span></label>
      <label class="login-check"><input type="checkbox" name="privacy" required> <span>Li e aceito a <a href="${LEGAL_PATHS.privacidade}" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
      <div class="login-turnstile"></div>
      <button class="login-primary" type="submit">Quero meu convite</button>
    </form>`;
  const form = content.querySelector('form')!;
  const widget = loadAccessConfig().then((config) => mountTurnstile(form.querySelector('.login-turnstile')!, config.turnstileSiteKey));
  handleSubmit(form, error, 'Enviando…', async (data) => {
    const turnstile = await widget;
    const email = text(data, 'email').trim();
    try {
      await accessApi.joinWaitlist({
        name: text(data, 'name'), email, memory: text(data, 'memory'), adult: checked(data, 'adult'), privacy: checked(data, 'privacy'),
        turnstile: turnstile.token(), website: text(data, 'website'),
      });
    } catch (reason) { turnstile.reset(); throw reason; }
    const config = await loadAccessConfig();
    content.innerHTML = `
      <p class="login-status-title">Quase lá!</p>
      <p class="login-subtitle"></p>
      <p class="login-note">Não chegou? Confira a caixa de spam. Os convites saem em ondas, por ordem de confirmação.</p>`;
    content.querySelector('.login-subtitle')!.textContent = `Enviamos um link para ${email}. Confirme o email para garantir a sua vaga.`;
    if (config.devMailbox) {
      const note = document.createElement('p');
      note.className = 'login-status-note';
      note.textContent = 'Servidor de desenvolvimento: o email ficou na caixa de saída local (/api/coffe/dev/mailbox, só para a equipe).';
      content.append(note);
    }
  });
}
