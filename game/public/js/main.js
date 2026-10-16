import { CHARACTERS } from './data.js';
import { BattleEngine } from './engine.js';
import { BattleRenderer } from './renderer.js';
import { AudioManager } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const screens = { menu: $('#screen-menu'), select: $('#screen-select'), battle: $('#screen-battle') };
const audio = new AudioManager();
const canvas = $('#battleCanvas');
const renderer = new BattleRenderer(canvas);
let engine = null;
let leftChoice = null;
let rightChoice = null;
let pickingSide = 'left';
let previousFrame = 0;
let resultSeen = false;
let returnFromResult = null;

const leftPanel = $('#leftPreview');
const rightPanel = $('#rightPreview');
const characterGrid = $('#characterGrid');
const enterButton = $('#enterBattleButton');

function showScreen(name) {
  for (const [screenName, element] of Object.entries(screens)) {
    const active = screenName === name;
    element.hidden = !active;
    element.classList.toggle('is-active', active);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function portraitMarkup(character) {
  if (character.spriteImage) {
    return `<img class="character-portrait-image" src="${character.spriteImage}" alt="" aria-hidden="true" decoding="async" />`;
  }
  return `<span class="sprite-pixel" data-weapon="${character.weapon}" style="--char-main:${character.sprite.main};--char-accent:${character.sprite.accent};--char-skin:${character.sprite.skin}"><i class="sprite-weapon"></i></span>`;
}

function renderFactionPanel(panel, character, side) {
  const isLeft = side === 'left';
  const sideName = isLeft ? 'PHE TRÁI' : 'PHE PHẢI';
  const number = isLeft ? '01' : '02';
  panel.innerHTML = `<div class="faction-label"><span>${sideName}</span><span class="faction-number">${number}</span></div>${character ? `<div class="faction-sprite">${portraitMarkup(character)}</div><h3 class="faction-name">${character.name}</h3><p class="faction-type">${character.archetype.toUpperCase()} · ${character.weapon.toUpperCase()}</p>${character.summary ? `<p class="faction-summary">${character.summary}</p>` : ''}<div class="faction-ultimate"><span>ULTIMATE</span><b>${character.ultimate.vn_name ?? character.ultimate.name}</b></div><div class="faction-hp"><span>HP TỐI ĐA</span><b>${character.stats.max_hp}</b></div>` : `<div class="faction-empty">ĐANG CHỜ<br />CHỌN ĐẤU SĨ</div>`}`;
}

function renderRoster() {
  characterGrid.innerHTML = CHARACTERS.map((character, index) => {
    const selectedLeft = leftChoice?.id === character.id;
    const selectedRight = rightChoice?.id === character.id;
    const selected = pickingSide === 'left' ? selectedLeft : selectedRight;
    const kind = character.id;
    const fallbackSummary = {
      kiem_si: 'Áp sát bằng các nhát chém gần và khống chế.',
      cung_thu: 'Giữ khoảng cách, bắn tên và dồn mưa tên.',
    }[character.id] ?? '';
    const sideBadges = `${selectedLeft ? '<span class="picked-badge">✓ PHE TRÁI</span>' : ''}${selectedRight ? '<span class="picked-badge">✓ PHE PHẢI</span>' : ''}`;
    const sideName = pickingSide === 'left' ? 'Phe Trái' : 'Phe Phải';
    return `<button class="character-card${selected ? ' is-selected' : ''}${selectedLeft ? ' has-left' : ''}${selectedRight ? ' has-right' : ''}" type="button" data-character-id="${character.id}" data-kind="${kind}" aria-label="${selected ? 'Đã chọn' : 'Chọn'} ${character.name} cho ${sideName}" aria-pressed="${selected}">
      <div class="card-topline"><span>ĐẤU SĨ ${String(index + 1).padStart(2, '0')}</span><span class="card-badges">${sideBadges}</span></div>
      <div class="card-portrait">${portraitMarkup(character)}</div>
      <h3 class="card-title">${character.name}</h3><p class="card-archetype">${character.archetype} · ${character.weapon}</p><p class="card-summary">${character.summary ?? fallbackSummary}</p>
      <div class="card-bottom"><span class="card-ultimate">${character.ultimate.vn_name ?? character.ultimate.name}</span><span class="card-hp">${character.stats.max_hp} HP</span></div>
      <span class="card-action">${selected ? `Đã chọn cho ${sideName}` : `Chọn cho ${sideName}`}<b aria-hidden="true">${selected ? '✓' : '→'}</b></span>
    </button>`;
  }).join('');
  $('#rosterCount').textContent = `${String(CHARACTERS.length).padStart(2, '0')} ĐẤU SĨ`;
  characterGrid.querySelectorAll('[data-character-id]').forEach((card) => {
    card.addEventListener('click', () => chooseCharacter(card.dataset.characterId));
  });
}

function updateSelectionView() {
  renderFactionPanel(leftPanel, leftChoice, 'left');
  renderFactionPanel(rightPanel, rightChoice, 'right');
  const leftTab = $('#pickLeftTab');
  const rightTab = $('#pickRightTab');
  leftTab.classList.toggle('is-current', pickingSide === 'left');
  rightTab.classList.toggle('is-current', pickingSide === 'right');
  leftTab.classList.toggle('is-complete', Boolean(leftChoice));
  rightTab.classList.toggle('is-complete', Boolean(rightChoice));
  leftTab.setAttribute('aria-current', pickingSide === 'left' ? 'step' : 'false');
  rightTab.setAttribute('aria-current', pickingSide === 'right' ? 'step' : 'false');
  rightTab.disabled = !leftChoice;
  $('#leftTabMark').textContent = leftChoice ? leftChoice.name : pickingSide === 'left' ? 'CHỌN ĐẤU SĨ' : 'ĐANG CHỜ';
  $('#rightTabMark').textContent = rightChoice ? rightChoice.name : leftChoice ? 'CHỌN ĐẤU SĨ' : 'ĐANG CHỜ';
  enterButton.disabled = !(leftChoice && rightChoice);
  $('#selectionHint').textContent = leftChoice && rightChoice
    ? 'Đội hình đã sẵn sàng · Bạn có thể đổi lựa chọn trước khi vào trận.'
    : pickingSide === 'left'
      ? 'Bước 1/2 · Chọn đấu sĩ cho Phe Trái.'
      : 'Bước 2/2 · Chọn đấu sĩ cho Phe Phải.';
  renderRoster();
}

function chooseCharacter(id) {
  const character = CHARACTERS.find((item) => item.id === id);
  if (!character) return;
  if (pickingSide === 'left') {
    leftChoice = character;
    pickingSide = 'right';
  } else {
    rightChoice = character;
    pickingSide = 'right';
  }
  updateSelectionView();
  (pickingSide === 'right' ? $('#pickRightTab') : $('#pickLeftTab')).focus({ preventScroll: true });
  void audio.unlock();
  audio.play('slash');
}

function showSelection() {
  pickingSide = 'left';
  updateSelectionView();
  showScreen('select');
}

function formatClock(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function startBattle() {
  if (!leftChoice || !rightChoice) return;
  if (returnFromResult) window.clearInterval(returnFromResult);
  returnFromResult = null;
  resultSeen = false;
  $('#resultOverlay').hidden = true;
  $('#battleStatus').classList.remove('is-ultimate');
  $('#battleStatus').textContent = 'TỰ ĐỘNG CHIẾN ĐẤU';
  engine = new BattleEngine(leftChoice, rightChoice, { onSound: (name) => audio.play(name) });
  renderer.resize();
  engine.setBounds(renderer.width, renderer.height);
  $('#leftName').textContent = leftChoice.name.toUpperCase();
  $('#rightName').textContent = rightChoice.name.toUpperCase();
  $('#leftType').textContent = `${leftChoice.archetype.toUpperCase()} · ${leftChoice.weapon.toUpperCase()}`;
  $('#rightType').textContent = `${rightChoice.archetype.toUpperCase()} · ${rightChoice.weapon.toUpperCase()}`;
  $('#leftUltimateName').textContent = leftChoice.ultimate.vn_name ?? leftChoice.ultimate.name;
  $('#rightUltimateName').textContent = rightChoice.ultimate.vn_name ?? rightChoice.ultimate.name;
  showScreen('battle');
  requestAnimationFrame(() => {
    renderer.resize();
    engine?.setBounds(renderer.width, renderer.height);
    engine?.update(0);
    renderer.render(engine);
  });
  void audio.unlock();
}

function updateHud() {
  if (!engine) return;
  const [left, right] = engine.fighters;
  $('#matchClock').textContent = formatClock(engine.elapsed);
  $('#leftSpeed').textContent = `Tốc độ tấn công: ${left.attackSpeed.toFixed(2)}`;
  $('#rightSpeed').textContent = `Tốc độ tấn công: ${right.attackSpeed.toFixed(2)}`;
  $('#leftEnergyFill').style.width = `${left.energy}%`;
  $('#rightEnergyFill').style.width = `${right.energy}%`;
  $('#leftEnergyText').textContent = left.ultimateState ? 'ULTIMATE' : `NẠP ${Math.floor(left.energy)}%`;
  $('#rightEnergyText').textContent = right.ultimateState ? 'ULTIMATE' : `NẠP ${Math.floor(right.energy)}%`;
  $('#leftEnergyFill').classList.toggle('is-ready', left.energy >= 99);
  $('#rightEnergyFill').classList.toggle('is-ready', right.energy >= 99);
  const isUltimate = Boolean(left.ultimateState || right.ultimateState);
  $('#battleStatus').classList.toggle('is-ultimate', isUltimate);
  if (isUltimate) {
    const active = left.ultimateState ? left : right;
    $('#battleStatus').textContent = `ULTIMATE / ${active.character.ultimate.vn_name.toUpperCase()}`;
  } else if (!engine.result) {
    $('#battleStatus').textContent = 'TỰ ĐỘNG CHIẾN ĐẤU';
  }
  if (engine.result && !resultSeen) showResult();
  if (engine.result && resultSeen) {
    const remaining = Math.max(0, 8 - engine.result.elapsed);
    $('#restartCountdown').textContent = String(Math.ceil(remaining)).padStart(2, '0');
    if (remaining <= 0) startBattle();
  }
}

function showResult() {
  resultSeen = true;
  const winner = engine.fighters.find((fighter) => fighter.side === engine.result.winnerSide);
  const loser = engine.fighters.find((fighter) => fighter.side === engine.result.loserSide);
  $('#resultTitle').textContent = `${winner.character.name.toUpperCase()} THẮNG!`;
  $('#resultSubtitle').textContent = `${loser.character.name} đã bị hạ gục. Võ đài thuộc về ${winner.character.name}.`;
  $('#resultOverlay').hidden = false;
  $('#battleStatus').textContent = 'KẾT THÚC TRẬN';
}

function frame(timestamp) {
  const dt = previousFrame === 0 ? 0 : Math.min((timestamp - previousFrame) / 1000, 0.04);
  previousFrame = timestamp;
  if (!screens.battle.hidden && engine) {
    engine.update(dt);
    renderer.render(engine);
    updateHud();
  }
  requestAnimationFrame(frame);
}

$('#startButton').addEventListener('click', () => {
  void audio.unlock();
  showSelection();
});
$('#guideButton').addEventListener('click', () => {
  $('#guideModal').hidden = false;
  void audio.unlock();
});
$('#closeGuideButton').addEventListener('click', () => { $('#guideModal').hidden = true; });
$('#guideConfirmButton').addEventListener('click', () => { $('#guideModal').hidden = true; });
$('#guideModal').addEventListener('click', (event) => {
  if (event.target === $('#guideModal')) $('#guideModal').hidden = true;
});
$('#pickLeftTab').addEventListener('click', () => { pickingSide = 'left'; updateSelectionView(); });
$('#pickRightTab').addEventListener('click', () => { if (leftChoice) { pickingSide = 'right'; updateSelectionView(); } });
$('#selectBackButton').addEventListener('click', () => showScreen('menu'));
enterButton.addEventListener('click', startBattle);
$('#rematchButton').addEventListener('click', startBattle);
$('#resultMenuButton').addEventListener('click', () => {
  if (returnFromResult) window.clearInterval(returnFromResult);
  returnFromResult = null;
  showScreen('menu');
});
$('#battleMenuButton').addEventListener('click', () => showScreen('menu'));
$('#changeFightersButton').addEventListener('click', () => showSelection());
window.addEventListener('resize', () => {
  if (screens.battle.hidden || !engine) return;
  renderer.resize();
  engine.setBounds(renderer.width, renderer.height);
});
$('#soundToggle').addEventListener('click', async () => {
  await audio.unlock();
  audio.setMuted(!audio.muted);
  $('#soundToggle').setAttribute('aria-pressed', String(audio.muted));
  $('#soundLabel').textContent = `ÂM THANH: ${audio.muted ? 'TẮT' : 'BẬT'}`;
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $('#guideModal').hidden = true;
});

renderRoster();
updateSelectionView();
requestAnimationFrame(frame);
