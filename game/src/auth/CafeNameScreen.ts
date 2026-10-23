import '@fontsource/fredoka/700.css';
import './cafe-name.css';
import { loadPlayerState, saveCafeName, type PlayerState } from '../game/player-state';
import { FALLBACK_WALLPAPER, loadWelcomeWallpaper, wallpaperURL } from '../game/welcome-wallpapers';
import { MODAL_OPEN_DURATION_MS, modalAnimationFrame } from '../screens/room/ModalAnimation';
import { applyLoadingStripes } from '../screens/loading/background-stripes';

/** The room is booted only after this screen completes, including on a first visit to another café. */
export async function showCafeNameScreen(host: HTMLElement, state: PlayerState): Promise<void> {
  const initial = !state.cafeNameChosen;
  const wallpaper = await loadWelcomeWallpaper();
  document.body.classList.remove('auth-page');
  document.body.classList.add('cafe-name-page');
  host.innerHTML = `
    <main class="cafe-welcome" aria-labelledby="cafe-name-title">
      <div class="cafe-welcome-stage">
        <img class="cafe-welcome-art" draggable="false">
        <div class="cafe-name-position">
          <form class="cafe-name-form">
            <h1 id="cafe-name-title"></h1>
            <div class="cafe-name-controls">
              <div class="cafe-name-field">
                <input id="cafe-name" name="cafeName" aria-labelledby="cafe-name-title" aria-describedby="cafe-name-error" autocomplete="off" spellcheck="false" required>
              </div>
              <button class="cafe-name-ok" type="submit">Ok</button>
            </div>
            <p id="cafe-name-error" role="alert" aria-live="polite"></p>
            <button class="cafe-name-back" type="button" hidden>Voltar ao café</button>
          </form>
        </div>
      </div>
    </main>`;
  const screen = host.querySelector<HTMLElement>('.cafe-welcome')!;
  const stage = host.querySelector<HTMLElement>('.cafe-welcome-stage')!;
  const setArtRatio = (width = 1151, height = 825) => stage.style.setProperty('--cafe-art-ratio', String(width / height));
  setArtRatio(wallpaper.width, wallpaper.height);
  const stripes = new ResizeObserver(() => applyLoadingStripes(screen, screen.clientWidth, screen.clientHeight));
  stripes.observe(screen);
  applyLoadingStripes(screen, screen.clientWidth, screen.clientHeight);
  const art = host.querySelector<HTMLImageElement>('.cafe-welcome-art')!;
  art.onload = () => setArtRatio(art.naturalWidth, art.naturalHeight);
  art.alt = wallpaper.alt;
  art.onerror = () => {
    art.onerror = null;
    art.src = wallpaperURL(FALLBACK_WALLPAPER);
    art.alt = FALLBACK_WALLPAPER.alt;
    setArtRatio(FALLBACK_WALLPAPER.width, FALLBACK_WALLPAPER.height);
  };
  art.src = wallpaperURL(wallpaper);
  const form = host.querySelector<HTMLFormElement>('form')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  const submit = form.querySelector<HTMLButtonElement>('.cafe-name-ok')!;
  const back = form.querySelector<HTMLButtonElement>('.cafe-name-back')!;
  const error = form.querySelector<HTMLElement>('[role="alert"]')!;
  form.querySelector('h1')!.textContent = initial ? 'Dê um nome ao seu Café para começar!' : 'Escolha o nome do seu Café!';
  input.value = initial ? 'Meu Café' : state.cafeName;
  back.hidden = initial;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    form.animate(Array.from({ length: 27 }, (_, i) => {
      const offset = i / 26;
      const frame = modalAnimationFrame('opening', offset * MODAL_OPEN_DURATION_MS);
      return { offset, transform: `scale(${frame.scale})`, opacity: frame.alpha };
    }), { duration: MODAL_OPEN_DURATION_MS, easing: 'linear' });
  }
  // Desktop focus helps keyboard entry; touch users keep the illustration visible until tapping.
  if (matchMedia('(pointer: fine)').matches) { input.focus(); input.select(); }
  try {
    await new Promise<void>((resolve) => {
      back.onclick = () => { if (!submit.disabled) resolve(); };
      form.onsubmit = (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        const name = input.value.trim().replace(/\s+/gu, ' ');
        if (!name || [...name].length > 40 || /[\p{Cc}\p{Cf}]/u.test(input.value)) {
          error.textContent = 'Escolha um nome de 1 a 40 caracteres visíveis.';
          input.focus();
          return;
        }
        submit.disabled = true;
        back.disabled = true;
        input.readOnly = true;
        submit.textContent = '…';
        error.textContent = '';
        form.setAttribute('aria-busy', 'true');
        void saveCafeName(name, initial).then(() => resolve()).catch((reason: unknown) => {
          error.textContent = reason instanceof Error ? reason.message : 'Não foi possível salvar. Tente novamente.';
          submit.disabled = false;
          back.disabled = false;
          input.readOnly = false;
          submit.textContent = 'Ok';
          form.removeAttribute('aria-busy');
        });
      };
    });
  } finally {
    stripes.disconnect();
    art.onload = null;
    art.onerror = null;
    form.onsubmit = null;
    back.onclick = null;
    document.body.classList.remove('cafe-name-page');
    host.replaceChildren();
  }
}

export async function prepareCafeEntry(host: HTMLElement): Promise<void> {
  const state = await loadPlayerState();
  const address = new URL(window.location.href);
  if (!state.cafeNameChosen || address.searchParams.get('renameCafe') === '1') {
    await showCafeNameScreen(host, state);
    address.searchParams.delete('renameCafe');
    window.history.replaceState(window.history.state, '', address);
  }
}
