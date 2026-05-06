const app = document.querySelector('#app');
const state = {
  scenarios: [],
  screen: 'start',
  activeCharacter: null,
  turnIndex: 0,
  gauge: 0,
  evidenceCount: 0,
  foundEvidence: [],
  selectedPostId: null,
  selectedReplyId: null,
  feedback: null,
  activeTab: 'secret',
  history: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

async function init() {
  try {
    const response = await fetch('data/scenarios.json');
    state.scenarios = await response.json();
    renderStart();
    registerServiceWorker();
  } catch (error) {
    app.innerHTML = `<main class="screen"><section class="hero"><h1>読み込み失敗</h1><p class="lead">シナリオデータを読み込めませんでした。${escapeHtml(error.message)}</p></section></main>`;
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
  }
}

function setScreen(screen) {
  state.screen = screen;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStart() {
  setScreen('start');
  app.innerHTML = `
    <main class="screen">
      <section class="hero">
        <div class="eyebrow">Suspense Text Detective</div>
        <h1>浮気異変<br>発見ゲーム</h1>
        <p class="lead">右のLINE風チャットと左の裏垢SNSを読み比べ、発言と投稿の矛盾を見つけてください。証拠を三つ集めれば相手は言い逃れできません。</p>
        <button class="primary-btn" data-action="select">キャラを選ぶ</button>
      </section>
    </main>`;
  $('[data-action="select"]').addEventListener('click', renderCharacterSelect);
}

function renderCharacterSelect() {
  setScreen('select');
  app.innerHTML = `
    <main class="screen select-screen">
      <section class="select-header">
        <button class="ghost-btn" data-action="back">← タイトルへ</button>
        <h1>相手を選ぶ</h1>
        <p class="lead">難易度が上がるほど、裏垢の匂わせは自然で、LINEの言い訳も巧妙になります。</p>
      </section>
      <section class="character-grid">
        ${state.scenarios.map((scenario) => `
          <article class="character-card">
            <div class="character-letter" aria-hidden="true">${scenario.name.slice(0, 1)}</div>
            <div class="card-heading">
              <span class="badge">${scenario.difficulty}</span>
              <h2>${scenario.name}</h2>
            </div>
            <p>${escapeHtml(scenario.profile)}</p>
            <p>${escapeHtml(scenario.details.openingText)}</p>
            <dl class="detail-list">
              <div><dt>印象</dt><dd>${escapeHtml(scenario.details.appearanceText)}</dd></div>
              <div><dt>性格</dt><dd>${escapeHtml(scenario.details.personalityText)}</dd></div>
              <div><dt>関係</dt><dd>${escapeHtml(scenario.details.relationshipText)}</dd></div>
              <div><dt>推理の焦点</dt><dd>${escapeHtml(scenario.details.hintStyle)}</dd></div>
            </dl>
            <button class="primary-btn" data-character="${scenario.characterId}">この相手で始める</button>
          </article>`).join('')}
      </section>
    </main>`;
  $('[data-action="back"]').addEventListener('click', renderStart);
  app.querySelectorAll('[data-character]').forEach((button) => {
    button.addEventListener('click', () => startGame(button.dataset.character));
  });
}

function startGame(characterId) {
  state.activeCharacter = state.scenarios.find((scenario) => scenario.characterId === characterId);
  state.turnIndex = 0;
  state.gauge = state.activeCharacter.maxGauge;
  state.evidenceCount = 0;
  state.foundEvidence = [];
  state.selectedPostId = null;
  state.selectedReplyId = null;
  state.feedback = null;
  state.activeTab = 'secret';
  state.history = [];
  setScreen('game');
  renderGame();
}

function currentTurn() {
  return state.activeCharacter.turns[state.turnIndex];
}

function renderGame() {
  const character = state.activeCharacter;
  const turn = currentTurn();
  if (!turn) return finishGame('clear');
  const gaugePercent = Math.max(0, (state.gauge / character.maxGauge) * 100);

  app.innerHTML = `
    <main class="screen game-screen">
      <section class="game-frame">
        <header class="status-bar">
          <div class="avatar-wrap">
            <div class="text-avatar" aria-hidden="true">${character.name.slice(0, 1)}</div>
            <div class="name-block">
              <strong>${character.name}</strong>
              <span>${character.difficulty} / ${character.tagline}</span>
              <small>${character.details.openingText}</small>
            </div>
          </div>
          <div>
            <div class="helper">信頼/疑念ゲージ</div>
            <div class="gauge" aria-label="残りゲージ ${state.gauge}"><div class="gauge-fill" style="width:${gaugePercent}%"></div></div>
          </div>
          <div class="stats">
            <span class="stat">Turn ${turn.turnId}/${character.turns.length}</span>
            <span class="stat">証拠 ${state.evidenceCount}/${character.requiredEvidence}</span>
            <span class="stat">ゲージ ${state.gauge}/${character.maxGauge}</span>
          </div>
        </header>
        <div class="boards">
          <section class="panel secret-panel ${state.activeTab === 'secret' ? 'active' : ''}" aria-label="裏垢SNS">
            <div class="panel-title sns-title"><span>裏垢SNS</span><span>@night_private</span></div>
            <div class="feed">
              ${turn.secretPosts.map((post) => `
                <button class="post-card ${state.selectedPostId === post.postId ? 'selected' : ''}" data-post="${post.postId}">
                  <div class="post-head"><span class="account-mark">裏</span><span>鍵付き投稿 #${post.postId}</span></div>
                  <div class="post-text">${escapeHtml(post.text)}</div>
                </button>`).join('')}
            </div>
          </section>
          <section class="panel line-panel ${state.activeTab === 'line' ? 'active' : ''}" aria-label="LINE風チャット">
            <div class="panel-title line-title"><span>LINE</span><span>${character.name}</span></div>
            <div class="chat">
              ${turn.lineMessages.map((message) => chatBubble(message, character)).join('')}
              ${state.history.map((message) => chatBubble(message, character)).join('')}
              ${state.feedback ? feedbackMarkup(state.feedback) : ''}
            </div>
          </section>
        </div>
        <footer class="action-area">
          <div class="helper">裏垢投稿を一つ選び、LINE返信を選んで「突きつける」。矛盾がなければ普通に返事してください。</div>
          <div class="choice-list">
            ${turn.replyChoices.map((choice) => `<button class="choice-btn ${state.selectedReplyId === choice.id ? 'selected' : ''}" data-reply="${choice.id}">${escapeHtml(choice.text)}</button>`).join('')}
          </div>
          <div class="action-buttons">
            <button class="danger-btn" data-action="accuse">突きつける</button>
            <button class="primary-btn" data-action="normal">普通に返事する</button>
            <button class="ghost-btn" data-action="select">キャラ選択に戻る</button>
          </div>
        </footer>
      </section>
      <nav class="tab-bar" aria-label="表示切り替え">
        <button class="${state.activeTab === 'secret' ? 'active' : ''}" data-tab="secret">裏垢SNS</button>
        <button class="${state.activeTab === 'line' ? 'active' : ''}" data-tab="line">LINE</button>
      </nav>
    </main>`;

  app.querySelectorAll('[data-post]').forEach((button) => button.addEventListener('click', () => {
    state.selectedPostId = button.dataset.post;
    renderGame();
  }));
  app.querySelectorAll('[data-reply]').forEach((button) => button.addEventListener('click', () => {
    state.selectedReplyId = button.dataset.reply;
    renderGame();
  }));
  $('[data-action="accuse"]').addEventListener('click', accuse);
  $('[data-action="normal"]').addEventListener('click', normalReply);
  $('[data-action="select"]').addEventListener('click', renderCharacterSelect);
  $('[data-action="next"]')?.addEventListener('click', nextTurn);
  app.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    renderGame();
  }));
}

function chatBubble(message, character) {
  const isTarget = message.speaker === 'target';
  return `
    <div class="chat-row ${isTarget ? 'target' : 'player'}">
      ${isTarget ? `<span class="bubble-icon" aria-hidden="true">${character.name.slice(0, 1)}</span>` : ''}
      <div class="bubble">${escapeHtml(message.text)}</div>
    </div>`;
}

function feedbackMarkup(feedback) {
  return `
    <div class="judgement ${feedback.ok ? 'ok' : 'ng'}">
      <strong>${feedback.ok ? '証拠を掴んだ' : '失敗'}</strong><br />
      ${escapeHtml(feedback.reaction)}<br />
      <span class="helper">解説：${escapeHtml(feedback.explanation)}</span>
      <div style="margin-top:10px"><button class="primary-btn" data-action="next">次へ</button></div>
    </div>`;
}

function accuse() {
  if (state.feedback) return;
  const turn = currentTurn();
  const choice = turn.replyChoices.find((item) => item.id === state.selectedReplyId);
  const playerText = choice?.text || '……証拠を突きつける';
  const ok = Boolean(
    turn.hasContradiction &&
    state.selectedPostId === turn.correctEvidencePostId &&
    state.selectedReplyId === turn.correctAccuseChoiceId
  );
  state.history.push({ speaker: 'player', text: playerText });
  resolveTurn(ok, ok ? turn.successReaction : turn.failReaction, ok ? turn.explanation : failureExplanation(turn));
}

function normalReply() {
  if (state.feedback) return;
  const turn = currentTurn();
  const normalChoice = turn.replyChoices.find((choice) => choice.type === 'normal') || turn.replyChoices[0];
  const ok = !turn.hasContradiction;
  state.history.push({ speaker: 'player', text: normalChoice.text });
  resolveTurn(ok, ok ? turn.successReaction : turn.failReaction, ok ? turn.explanation : `このターンには「${turn.evidenceLabel}」という矛盾があった。見逃すと相手に警戒される。`);
}

function resolveTurn(ok, reaction, explanation) {
  const turn = currentTurn();
  if (ok && turn.hasContradiction) {
    state.evidenceCount += 1;
    state.foundEvidence.push(turn.evidenceLabel);
  }
  if (!ok) state.gauge -= 1;
  state.feedback = { ok, reaction, explanation };
  state.activeTab = 'line';
  renderGame();
}

function failureExplanation(turn) {
  if (!turn.hasContradiction) return turn.explanation;
  if (state.selectedPostId !== turn.correctEvidencePostId) return '選んだ裏垢投稿は、LINE発言との決定的な矛盾にはなっていない。';
  if (state.selectedReplyId !== turn.correctAccuseChoiceId) return '証拠投稿は合っているが、LINEで突くポイントがずれている。';
  return '証拠と返信の組み合わせを確認しよう。';
}

function nextTurn() {
  if (state.evidenceCount >= state.activeCharacter.requiredEvidence) return finishGame('clear');
  if (state.gauge <= 0) return finishGame('gameOver');
  state.turnIndex += 1;
  state.selectedPostId = null;
  state.selectedReplyId = null;
  state.feedback = null;
  state.history = [];
  state.activeTab = 'secret';
  if (state.turnIndex >= state.activeCharacter.turns.length) {
    return finishGame(state.evidenceCount >= state.activeCharacter.requiredEvidence ? 'clear' : 'gameOver');
  }
  renderGame();
}

function finishGame(type) {
  setScreen('result');
  const character = state.activeCharacter;
  const isClear = type === 'clear';
  app.innerHTML = `
    <main class="screen">
      <section class="result-card">
        <div class="eyebrow">${isClear ? 'Case Closed' : 'Bad End'}</div>
        <h1>${isClear ? 'クリア' : 'ゲームオーバー'}</h1>
        <p>${isClear ? character.endings.clear : character.endings.gameOver}</p>
        <p>発見済み証拠：${state.evidenceCount}/${character.requiredEvidence} / 残りゲージ：${Math.max(0, state.gauge)}</p>
        <ol class="evidence-list">
          ${state.foundEvidence.length ? state.foundEvidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>証拠を掴めなかった。</li>'}
        </ol>
        <div class="action-buttons" style="justify-content:center">
          <button class="primary-btn" data-action="retry">リトライ</button>
          <button class="ghost-btn" data-action="select">キャラ選択に戻る</button>
          <button class="ghost-btn" data-action="title">タイトルへ</button>
        </div>
      </section>
    </main>`;
  $('[data-action="retry"]').addEventListener('click', () => startGame(character.characterId));
  $('[data-action="select"]').addEventListener('click', renderCharacterSelect);
  $('[data-action="title"]').addEventListener('click', renderStart);
}

init();
