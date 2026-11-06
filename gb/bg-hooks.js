'use strict';
/* Bar Grass Color Sort: GameBull hooks, loaded after the client's home.js (their files unchanged). Classic scripts share
 * globals, so their top-level functions (render, startAuthorized) can be wrapped and their lets read and set (bottles,
 * trace, moves, playing, current). What this adds, all for GameBull Stage Mode only:
 *  - board save and resume: every move is kept with the attempt (gb/bg-host.js, localStorage), and a reopen that reuses
 *    the attempt puts the board back as it was, never the starting board (their GAMEBULL-INTEGRATION.md asks for this);
 *  - the attempt's time limit (GameBull requires one, at most 59 min): a small pill in the last 10 minutes; at 0 the
 *    attempt ends through their own GAME OVER dialog and endParticipation();
 *  - the reason a GAME OVER happened stays on their dialog (PONTE build 6);
 *  - the all-clear voucher (last stage, status from the server) inside their dialog, whose button closes the game into
 *    the GameBull app's coupon (gamebull:close + to: /coupons/<id>, relayed by the loading page; trap W18);
 *  - a "back to GameBull" button under their START when the game cannot start (Game Start launch, no launch data);
 *  - no dead board: a tap on a finished board brings their clear dialog back (trap W20);
 *  - the loading page signal once all their pictures are decoded; iPhone sound (traps W1, W2);
 *  - the fit to the GameBull window (fixed window, no scroll, no zoom, full width, no overlaps): see BarGrassFit below.
 */
(function () {
  const ENV = window.BAR_GRASS_GB || {};
  const gb = () => window.BarGrassGB;
  const log = (...a) => console.log('[BG-GB]', ...a);
  log(`Build v${ENV.build} (${ENV.gameId}, API ${ENV.apiBase}).`);

  function closeToGameBull(to) {
    if (!gb().embedded) return false;
    const msg = { type: 'gamebull:close' }; if (to) msg.to = to;
    log('gamebull:close ' + JSON.stringify(msg) + ' (through the loading page relay).');
    window.parent.postMessage(msg, location.origin);
    return true;
  }

  /* ── styles for the few GameBull elements (scoped to .bggb-*, trap W10; colours from their grass.css) ── */
  const css = document.createElement('style');
  css.textContent = `
  .bggb-timer{position:absolute;right:8px;z-index:6;margin:0;padding:1px 9px;border:1px solid #bd8c3b88;border-radius:999px;
    background:#130f09cc;color:#ffe4a0;font:600 11px/1.5 system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
  .bggb-timer[hidden]{display:none}
  .bggb-timer.bggb-low{border-color:#e0705a;color:#ffb4a2}
  .bggb-reward{margin:14px 0 4px;padding:12px 10px;border-top:1px solid #e8bd6b55;font:13px/1.6 system-ui,sans-serif;color:#e9ce97}
  .bggb-reward[hidden]{display:none}
  .bggb-reward h3{margin:0 0 4px;font:600 16px/1.4 Georgia,serif;color:#ffefbd}
  .bggb-reward p{margin:4px 0;font-size:13px}
  .bggb-reward img{display:block;max-width:100%;max-height:140px;margin:8px auto;border-radius:6px}
  .bggb-reward button{margin-top:8px}
  .bggb-back{display:block;margin:10px auto 6px}
  .bggb-reason{margin:0 0 6px;color:#ffe4a0;font-size:14px}
  .bggb-reason[hidden]{display:none}
  /* fixed window: BarGrassFit fits their page to the window (scale 1); no scrollbar, no rubber band, no text selection on fast taps */
  html{overflow:hidden;scrollbar-width:none;overscroll-behavior:none;background:#100c06 url("gb/side-bg.jpg") center/cover no-repeat}
  html::-webkit-scrollbar{display:none}
  body{overscroll-behavior:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
  dialog{overscroll-behavior:contain}
  /* in the fixed window their message line and the last row's numbers can land on the bright table of their backdrop */
  #message,#board .num{text-shadow:0 1px 3px #000,0 0 6px #000}
  /* the GameBull app's expanded view: its Done and collapse float over the frame's top corners (see fitCorners) */
  body.bggb-corners #sound,body.bggb-corners #back-home{top:var(--bggb-band,54px)}
  body.bggb-corners dialog{max-height:calc(100dvh - 116px)}`;
  document.head.appendChild(css);

  /* ── fit to the GameBull window: no scrolling, full width, at scale 1 ──────────────────────────────────────────
   * Their page is a 430 px phone column (body{max-width:430px;margin:0 auto}) and a scrolling document: their neon sign
   * header (about 140 px), their stats, then bottles sized from the board's width (.bottle{width:100%;aspect-ratio:.49}
   * in a 3- or 4-column grid), up to 4 rows: over 1,000 px. What QA found on the other Stage Mode games is built in
   * from the start: no scroll (PONTE build 3), one size per screen (build 4), no narrow column (build 5), the app's
   * corners clear (PHOTO JIGSAW build 5). Only layout is set, by one stylesheet of ours, after every render, screen
   * change and resize:
   *  - board: the column count that gives the biggest bottles in the height left under their stats (their own count
   *    when it is as good), never bigger than their largest bottle (3 columns). Their pours use the bottles' own boxes,
   *    so they follow. Their ✓ / bottle number hangs 21 px under a bottle and their 完成！ label 22 px over one, which
   *    collide in their row gap (23 px + 13 px margin = 36 px), so the row gap is 30 px here;
   *  - TOP: when taller than the window, only their cocktail picture block (.home-display) gets shorter; the picture
   *    follows its height (their .hero-hookah{height:90%}) and keeps clear of their caption under it, and the empty
   *    margins of their error line (no error showing) go first;
   *  - short windows (under COMPACT_BELOW: a small iPhone under Safari's bars and the app's bar): tighter margins and
   *    their sign's empty top and bottom cropped (same scale, nothing removed), so the glasses stay big instead of the
   *    whole frame being scaled down (39 px glasses at 375x520 without this);
   *  - their main{padding-bottom} never pushes the page past the window;
   *  - the timer pill floats right of their heading, so nothing moves when it appears.
   * The loading page (loader.ts) scales the frame only if something still cannot fit (a short window). */
  const fitStyle = document.createElement('style'); fitStyle.id = 'bggb-fit'; document.head.appendChild(fitStyle);
  const ROW_GAP = 30, COMPACT_BELOW = 640;
  const board = $('board'), home = $('home');
  const visible = el => !!el && el.getClientRects().length > 0;
  // The compact rules, in force while the page is measured. Their sign fills 3 % to 30 % of the picture's width from its top.
  function fitCompact() {
    if (innerHeight >= COMPACT_BELOW) return '';
    const w = document.body.clientWidth, cut = Math.round(w * .03), h = Math.round(w * .27);
    return `header{height:${h}px!important;background-position:center -${cut}px!important}` +
      `main>h1{margin-bottom:4px!important}.stats{padding:3px 0!important;margin-bottom:0!important}.stats span{font-size:8px!important}.stats strong{font-size:20px!important}` +
      `#board{margin-top:26px!important;margin-bottom:9px!important}#message{margin-top:0!important;min-height:18px!important}` +
      `#home{padding-bottom:8px!important}#home .home-logo{height:${h}px!important;background-position:center -${cut}px!important}` +
      `.home-intro h2{font-size:20px!important;margin:3px 0!important;line-height:1.45!important}.home-intro p{margin:3px 0!important;line-height:1.6!important}` +
      `.home-actions{margin-top:4px!important}.home-play{min-height:44px!important;padding:6px 20px!important}#participation-note{margin:6px 0 2px!important;line-height:1.5!important}.home-foot{padding-top:4px!important}`;
  }
  function fitTop(compact) {
    if (!document.body.classList.contains('home-open')) return '';
    fitStyle.textContent = compact;
    const disp = home.querySelector('.home-display');
    let over = home.offsetHeight - innerHeight;
    if (!disp || over <= 0.5) return '';
    const err = $('home-error');
    let rule = '';
    if (!err.textContent) { rule = '#home-error{margin:0!important;min-height:0!important}'; fitStyle.textContent = compact + rule; over = home.offsetHeight - innerHeight; }
    if (over <= 0.5) return rule;
    const nh = Math.max(84, Math.floor(disp.offsetHeight - over));
    return rule + `.home-display{height:${nh}px!important}.home-display .hero-hookah{height:${nh - 20}px!important}`;
  }
  function fitBoard(compact) {
    const n = board.children.length;
    if (!n || !visible(board)) return '';
    fitStyle.textContent = compact;                              // their own layout first, then measure it
    const theirCols = Math.max(1, parseInt(board.style.getPropertyValue('--columns'), 10) || 3);
    const first = board.children[0], ratio = first.offsetWidth / first.offsetHeight;
    const cs = getComputedStyle(board), colGap = parseFloat(cs.columnGap) || 0, margin = parseFloat(getComputedStyle(first).marginBottom) || 0;
    // Room under the board for what follows it in their page: their #message line, its margin and their main padding.
    const msg = $('message'), boardBox = board.getBoundingClientRect();
    const below = visible(msg) ? Math.max(0, msg.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(msg).marginBottom) || 0) - boardBox.bottom) : 0;
    const width = board.clientWidth, height = innerHeight - boardBox.top - below - 2;
    const widest = c => (width - (c - 1) * colGap) / c, biggest = widest(3);
    const size = c => { const rows = Math.ceil(n / c); return Math.min(widest(c), ((height - (rows - 1) * ROW_GAP) / rows - margin) * ratio, biggest); };
    let cols = Math.min(theirCols, n), best = size(cols);
    for (let c = 1; c <= n; c++) { const w = size(c); if (w > best + 0.5) { best = w; cols = c; } }
    best = Math.max(20, Math.floor(best));
    return `#board{grid-template-columns:repeat(${cols},minmax(0,1fr))!important;row-gap:${ROW_GAP}px!important;margin-left:auto!important;margin-right:auto!important;width:${cols * best + (cols - 1) * colGap}px!important}main{padding-bottom:0!important}`;
  }
  function fitTimer() {
    const eyebrow = document.querySelector('main>.eyebrow');
    return visible(eyebrow) ? `.bggb-timer{top:${eyebrow.offsetTop}px}` : '';
  }
  // Which view of the GameBull app: loader.ts sets BG_APP_CORNERS. In the expanded view Done (top left, about 62x44) and
  // collapse (top right, 44x44) float 4 px in, over the frame, so their ‹ TOP and ♫ go below them, only when their column
  // reaches those corners (a wide window centres it away from them). Screen px, so divided by the frame's scale.
  function fitCorners() {
    let on = false, band = 54;
    if (window.BG_APP_CORNERS) {
      const f = window.frameElement, k = f ? (f.getBoundingClientRect().width / f.offsetWidth) || 1 : 1;
      const r = document.body.getBoundingClientRect();
      on = r.left * k < 72 || (innerWidth - r.right) * k < 56;
      band = Math.ceil(54 / k);
    }
    document.body.classList.toggle('bggb-corners', on);
    if (on) document.body.style.setProperty('--bggb-band', band + 'px'); else document.body.style.removeProperty('--bggb-band');
  }
  let lastFit = '';
  function BarGrassFit() {
    fitCorners();
    const compact = fitCompact();
    const rule = compact + fitTop(compact) + fitBoard(compact);
    fitStyle.textContent = rule;
    fitStyle.textContent = rule + fitTimer();
    if (rule === lastFit) return;
    lastFit = rule;
    const m = /repeat\((\d+)[^]*?;width:(\d+)/.exec(rule) || /repeat\((\d+)[^]*?width:(\d+)/.exec(rule);
    log(`Fit ${innerWidth}x${innerHeight}: ${m ? `board ${m[1]} columns, ${m[2]} px wide` : 'their layout'}${compact ? ', compact' : ''}${/home-display/.test(rule) ? ', TOP picture shortened' : ''}.`);
  }
  window.BarGrassFit = BarGrassFit;                              // also called by loader.ts before it measures
  addEventListener('resize', BarGrassFit);
  const theirEnterGame = enterGame;
  enterGame = function () { theirEnterGame.apply(this, arguments); BarGrassFit(); };
  const theirShowHome = showHome;
  showHome = function () { theirShowHome.apply(this, arguments); BarGrassFit(); };

  /* ── never a scroll or a rubber band (their pour lock does this only while a pour runs); a dialog may scroll inside ── */
  const noScroll = e => { if (e.cancelable && !(e.target && e.target.closest && e.target.closest('dialog'))) e.preventDefault(); };
  document.addEventListener('touchmove', noScroll, { passive: false });
  document.addEventListener('wheel', noScroll, { passive: false });
  addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); });   // focus() can still scroll a clipped page

  /* ── board save: after their render, the attempt's moves (their trace) go to the host ── */
  let restoring = false;
  const theirRender = render;
  render = function () {
    theirRender.apply(this, arguments);
    BarGrassFit();
    if (!restoring && playing && gb()) gb().saveMoves(trace);
  };

  /* ── board resume: their startAuthorized deals the starting board; a reused attempt gets its moves back ── */
  const theirStart = startAuthorized;
  startAuthorized = function (n) {
    restoring = true;
    try { theirStart.apply(this, arguments); } finally { restoring = false; }
    const a = gb() && gb().takeResume();
    if (!a || a.stage !== n + 1 || !a.moves.length) return;
    const restored = gb().replay(a.stage, a.moves);
    if (!restored) { log(`Stage ${a.stage}: saved moves do not replay; the board stays at the start.`); return; }
    bottles = restored; trace = a.moves.map(m => ({ from: m.from, to: m.to, units: m.units })); moves = trace.length;
    render();
    log(`Stage ${a.stage}: board restored (${moves} moves).`);
    if (won()) {
      // Cleared before the reload, report not confirmed yet: their own confirmation and dialog (same report resent).
      confirmCompletion(); if (!$('win').open) $('win').showModal();
    } else checkDeadlock();
  };

  /* ── no dead board (trap W20): their 盤面を見る closes the dialog onto a finished board, where taps do nothing ── */
  board.addEventListener('click', () => { if (playing && won() && !pouring && !submitting && !$('win').open) $('win').showModal(); });

  /* ── time limit: a pill right of their heading in the last 10 minutes; at 0, their GAME OVER ends the attempt ── */
  const SHOW_LAST_MS = 600000;
  const timer = document.createElement('span');
  timer.className = 'bggb-timer'; timer.hidden = true; timer.setAttribute('aria-live', 'off');
  const stats = document.querySelector('main .stats'); if (stats) stats.after(timer);
  const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function timeUp() {
    if (!playing || won() || submitting || pouring || ending) return;
    log(`Stage ${current + 1}: attempt time limit reached; ending it.`);
    stopDeadlockCheck(); playing = false; clearCelebration();
    $('gameover-result').textContent = '制限時間を過ぎました。';
    showReason('制限時間を過ぎました。');
    if (!$('gameover').open) $('gameover').showModal();
    endParticipation();
  }

  /* ── why the attempt ended, kept on their GAME OVER dialog ──
   * Their showGameOver writes the reason (「これ以上クリアできる手順がありません。」 = their dead-end check, a proven
   * unsolvable board) into #gameover-result, then their endParticipation replaces it with 「この参加は終了しました…」
   * once the end is confirmed, so the player saw "ended" with no reason (PONTE QA, live test). The reason stays on a line
   * of its own above their text, in their own words. */
  const reason = document.createElement('p'); reason.className = 'bggb-reason'; reason.hidden = true;
  const overText = $('gameover-result'); if (overText) overText.before(reason);
  function showReason(text) { reason.textContent = text; reason.hidden = false; }
  const theirShowGameOver = showGameOver;
  showGameOver = function () {
    const was = playing && !won();
    theirShowGameOver.apply(this, arguments);
    if (was && $('gameover').open) { showReason($('gameover-result').textContent); log(`Stage ${current + 1}: dead end (their check), attempt ended.`); }
  };
  $('gameover').addEventListener('close', () => { reason.hidden = true; });
  setInterval(() => {
    const a = gb() && gb().active;
    const on = !!(a && playing && !a.clearBody && participation.attempt && participation.attempt.attemptId === a.attemptId && !won());
    const left = on ? gb().remainingMs() : 0;
    timer.hidden = !on || left > SHOW_LAST_MS;
    if (!on) return;
    timer.textContent = '残り ' + fmt(left);
    timer.classList.toggle('bggb-low', left <= 60000);
    if (left <= 0) timeUp();
  }, 250);

  /* ── the all-clear voucher inside their 完成！ dialog (their <dialog> is in the top layer, trap W16) ── */
  const safeUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u : null; } catch { return null; } };
  const box = document.createElement('div'); box.className = 'bggb-reward'; box.hidden = true;
  const result = $('result'); if (result) result.after(box);
  addEventListener('bar-grass-gb:clear', e => {
    const reward = e.detail && e.detail.reward;
    if (!reward) return;
    const text = { ISSUED: 'ギフト券が発行され、GameBullのクーポン一覧に入りました。', ALREADY_CLAIMED: 'この店舗の特典はすでに受け取り済みです。',
      NONE_CONFIGURED: '', OUT_OF_STOCK: '特典は一時的に在庫切れです。後でGameBullアプリのゲーム画面から受け取れます。' }[reward.status] ?? '特典の状態はGameBullでご確認ください。';
    box.replaceChildren();
    const add = (tag, value) => { if (!value) return; const el = document.createElement(tag); el.textContent = value; box.append(el); };
    if (reward.status !== 'NONE_CONFIGURED') add('h3', reward.title || '全ステージ達成特典');
    add('p', text); if (reward.status !== 'NONE_CONFIGURED') add('p', reward.benefit);
    const img = safeUrl(reward.imageUrl);
    if (img && reward.status !== 'NONE_CONFIGURED') { const im = new Image(); im.alt = reward.title || '全ステージ達成特典'; im.referrerPolicy = 'no-referrer'; im.src = img.href; box.append(im); }
    const redeem = reward.status === 'ISSUED' && safeUrl(reward.redeemUrl);
    if (redeem) {
      const b = document.createElement('button'); b.className = 'action primary'; b.type = 'button'; b.textContent = 'GameBullでギフト券を開く';
      // Inside the app the frame has no allow-popups: close the game and let the app open the coupon
      // (gamebull-whitelabel d85807c honours to: /coupons/<id>). Outside the app, open the wallet link.
      b.onclick = () => { const m = /^\/coupons\/[^/?#]+$/.exec(redeem.pathname); if (!closeToGameBull(m ? m[0] : undefined)) window.open(redeem.href, '_blank', 'noopener,noreferrer'); };
      box.append(b);
    }
    box.hidden = !box.childNodes.length;
    log('All-clear reward: ' + reward.status + '.');
  });

  /* ── start-up check: a launch that cannot play says so under their START, with a way back to GameBull ── */
  participation.progress().then(p => log(`Progress ${p.completedStages} / ${ENV.totalStages}.`)).catch(e => {
    log('Start-up message: ' + e.message);
    if (!$('home-error').textContent) $('home-error').textContent = e.message;
    if (gb().embedded && !document.querySelector('.bggb-back') && e.code !== 'network') {
      const b = document.createElement('button'); b.className = 'action bggb-back'; b.type = 'button'; b.textContent = 'GameBullに戻る';
      b.onclick = () => closeToGameBull(); $('home-error').after(b);
    }
    BarGrassFit();
  });

  /* ── loading page down once all their pictures are decoded (the glass, ice and lime first show on the board, and a
   *    late decode would show as empty glasses or a jump on the first clear) ── */
  const pictures = ['assets/bar-background.png', 'assets/hero-cocktail.png', 'assets/glass.png', 'assets/ice.png', 'assets/lime.png'];
  let loaded = 0;
  const progress = p => { try { window.parent.gbLoaderProgress && window.parent.gbLoaderProgress(p); } catch { /* not in our frame */ } };
  let signalled = false;
  const done = () => { if (signalled) return; signalled = true; try { window.parent.gbLoaderDone && window.parent.gbLoaderDone(); } catch { /* not in our frame */ } };
  const keep = window.__bggbPictures = [];                        // held, so the browser keeps them decoded
  Promise.all(pictures.map(src => new Promise(res => {
    const im = new Image(); keep.push(im);
    const finish = () => { progress(++loaded / pictures.length); res(); };
    im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(finish); };
    im.onerror = finish; im.src = src;
  }))).then(() => { progress(1); BarGrassFit(); done(); });
  setTimeout(done, 20000); // never keep the loading page up on a picture that will not come

  /* ── iPhone sound. Their audio.js starts Web Audio on pointerdown, which iPhone does not count as a tap for sound
   *    (traps W1, W2; Mamoru, Kurozumi). Their unlock() is private, so their own listener is called again from inside
   *    touchend / click, which do count: a pointerdown sent to their listener there. Their ♫ button keeps its own click,
   *    so a tap on it is left alone, as their listener does. Web Audio also plays with the silent switch on. ── */
  document.addEventListener('pointerdown', () => { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* n/a */ } }, { capture: true, once: true });
  const soundTap = e => {
    if (e.target && e.target.closest && e.target.closest('#sound')) return;
    try { document.body.dispatchEvent(new (window.PointerEvent || Event)('pointerdown', { bubbles: true })); } catch { /* n/a */ }
  };
  document.addEventListener('touchend', soundTap, { capture: true, passive: true });
  document.addEventListener('click', soundTap, { capture: true });
})();
