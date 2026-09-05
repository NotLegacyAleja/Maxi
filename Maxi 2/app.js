const conversation = document.querySelector('#conversation');
const composer = document.querySelector('#composer');
const messageInput = document.querySelector('#messageInput');
const suggestions = document.querySelector('#suggestions');
const memoryDrawer = document.querySelector('#memoryDrawer');
const memoryList = document.querySelector('#memoryList');
const memoryForm = document.querySelector('#memoryForm');
const memoryInput = document.querySelector('#memoryInput');
const settingsDrawer = document.querySelector('#settingsDrawer');
const drawerBackdrop = document.querySelector('#drawerBackdrop');
const settingsForm = document.querySelector('#settingsForm');
const modelInput = document.querySelector('#modelInput');
const apiKeyInput = document.querySelector('#apiKeyInput');
const personalityInput = document.querySelector('#personalityInput');
const greetingText = document.querySelector('#greetingText');
const connectionStatus = document.querySelector('#connectionStatus');
const statusDot = document.querySelector('#statusDot');
const sendButton = document.querySelector('.send-button');
const clearConversation = document.querySelector('#clearConversation');
const historyDrawer = document.querySelector('#historyDrawer');
const chatList = document.querySelector('#chatList');
const attachButton = document.querySelector('#attachButton');
const fileInput = document.querySelector('#fileInput');
const voiceButton = document.querySelector('#voiceButton');
const systemsToggle = document.querySelector('#systemsToggle');
const capabilityGrid = document.querySelector('#capabilityGrid');
const overlayPanel = document.querySelector('#overlayPanel');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayContent = document.querySelector('#overlayContent');
const sessionClock = document.querySelector('#sessionClock');
const presenceState = document.querySelector('#presenceState');
let activeMode = 'Chat';
let isListening = false;
let tetrisTimer;
let tetrisKeyHandler;
let overlayDrag = null;
const sessionStarted = Date.now();
const activityEvents = loadJson('maxi-activity', []);

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

let storedMessages = loadJson('maxi-messages', []);
let memories = loadJson('maxi-memories', []);
const config = loadJson('maxi-ai-config', null) || {
  model: 'gemini-2.5-flash',
  apiKey: '',
  personality: 'warm'
};
if (!Array.isArray(storedMessages)) storedMessages = [];
if (!Array.isArray(memories)) memories = [];
if (!config.model || config.model === 'llama3.2' || config.model === 'gemini-2.0-flash') config.model = 'gemini-2.5-flash';
if (!['warm', 'sharp', 'calm', 'playful'].includes(config.personality)) config.personality = 'warm';
let isResponding = false;
let chats = loadJson('maxi-chats', []);
if (!Array.isArray(chats) || !chats.length) {
  chats = [{ id: crypto.randomUUID(), title: 'New conversation', messages: storedMessages, updatedAt: Date.now() }];
}
let currentChatId = localStorage.getItem('maxi-current-chat') || chats[0].id;
if (!chats.some(chat => chat.id === currentChatId)) currentChatId = chats[0].id;
storedMessages = chats.find(chat => chat.id === currentChatId).messages;
saveChats();

function saveMessages() {
  const currentChat = chats.find(chat => chat.id === currentChatId);
  currentChat.messages = storedMessages.slice(-40);
  currentChat.updatedAt = Date.now();
  localStorage.setItem('maxi-messages', JSON.stringify(storedMessages.slice(-40)));
  saveChats();
}

function saveChats() {
  localStorage.setItem('maxi-chats', JSON.stringify(chats));
  localStorage.setItem('maxi-current-chat', currentChatId);
}

function chatTitle(chat) {
  const firstUserMessage = chat.messages.find(message => message.role === 'user');
  return firstUserMessage?.text?.split('\n')[0].slice(0, 34) || chat.title || 'New conversation';
}

function renderChatList() {
  chatList.innerHTML = chats.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(chat => `
    <div class="chat-row ${chat.id === currentChatId ? 'active' : ''}">
      <button class="chat-select" type="button" data-chat-id="${chat.id}"><span class="chat-row-icon">⌁</span><span><strong>${escapeHtml(chatTitle(chat))}</strong><small>${chat.messages.length ? `${chat.messages.length} messages` : 'Empty chat'}</small></span></button>
      <button class="chat-delete" type="button" data-delete-chat="${chat.id}" aria-label="Delete ${escapeHtml(chatTitle(chat))}">×</button>
    </div>`).join('');
  chatList.querySelectorAll('[data-chat-id]').forEach(button => button.addEventListener('click', () => switchChat(button.dataset.chatId)));
  chatList.querySelectorAll('[data-delete-chat]').forEach(button => button.addEventListener('click', () => deleteChat(button.dataset.deleteChat)));
}

function renderCurrentMessages() {
  conversation.querySelectorAll('[data-dynamic="true"]').forEach(message => message.remove());
  storedMessages.forEach(message => addMessage(message.text, message.role));
  suggestions.classList.toggle('hidden', storedMessages.length > 0);
}

function switchChat(chatId) {
  const chat = chats.find(item => item.id === chatId);
  if (!chat || chatId === currentChatId) return closeHistory();
  currentChatId = chatId;
  storedMessages = chat.messages;
  saveChats();
  renderCurrentMessages();
  renderChatList();
  closeHistory();
  logActivity(`Switched to ${chatTitle(chat)}`);
}

function createChat() {
  const chat = { id: crypto.randomUUID(), title: 'New conversation', messages: [], updatedAt: Date.now() };
  chats.push(chat);
  currentChatId = chat.id;
  storedMessages = chat.messages;
  saveChats();
  renderCurrentMessages();
  renderChatList();
  closeHistory();
  messageInput.focus();
}

function deleteChat(chatId) {
  if (chats.length === 1) return createChat();
  chats = chats.filter(chat => chat.id !== chatId);
  if (chatId === currentChatId) {
    currentChatId = chats[0].id;
    storedMessages = chats[0].messages;
    renderCurrentMessages();
  }
  saveChats();
  renderChatList();
}

function closeHistory() {
  historyDrawer.classList.remove('open');
  historyDrawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.classList.remove('open');
  drawerBackdrop.setAttribute('aria-hidden', 'true');
}

function logActivity(label) {
  activityEvents.push({ label, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  activityEvents.splice(0, Math.max(0, activityEvents.length - 8));
  localStorage.setItem('maxi-activity', JSON.stringify(activityEvents));
}

function addMessage(text, role) {
  const safeRole = role === 'maxi' ? 'maxi' : 'user';
  const article = document.createElement('article');
  article.className = `message ${safeRole}-message`;
  if (text === 'Thinking...') article.classList.add('typing-message');
  article.dataset.dynamic = 'true';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  article.innerHTML = `
    <div class="message-avatar">${safeRole === 'maxi' ? 'M' : 'A'}</div>
    <div class="message-content">
      <div class="message-meta"><strong>${safeRole === 'maxi' ? 'Maxi' : 'You'}</strong><span>${time}</span></div>
      <div class="bubble"><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p></div>
    </div>`;
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function askMaxi() {
  const context = memories.length
     ? `\nSaved memories about the user:\n${memories.map(memory => `- ${memory}`).join('\n')}` 
    : '';
  if (!config.apiKey) throw new Error('Add your Gemini API key in AI connection settings');
  const contents = storedMessages.slice(-14).map(message => ({
    role: message.role === 'maxi' ? 'model' : 'user',
    parts: [{ text: message.text }]
  }));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const requestBody = {
      systemInstruction: { parts: [{ text: `You are Maxi, a thoughtful, practical personal AI. Your personality is ${personalityPrompt(config.personality)}. Be conversational, specific, and honest. Current mode: ${activeMode}. Use saved memories when relevant. Do not claim to control a PC or see anything you cannot access.${context}` }] },
      contents,
      generationConfig: { temperature: 0.7 }
    };
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request timed out');
    throw new Error('Network request failed');
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error?.message || `Gemini returned ${response.status}`);
  }
  const data = await response.json();
  const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!answer) throw new Error('The AI returned an empty response');
  return answer;
}

function personalityPrompt(personality) {
  return {
    warm: 'warm, perceptive, encouraging, and emotionally aware',
    sharp: 'precise, direct, efficient, and candid without being harsh',
    calm: 'steady, patient, grounding, and thoughtful under pressure',
    playful: 'curious, inventive, lightly witty, and enthusiastic without becoming distracting'
  }[personality] || 'warm, perceptive, and practical';
}

function personalityGreeting(personality) {
  return {
    warm: 'Good morning, Aleja. I’m here and ready.',
    sharp: 'Ready when you are. What needs solving?',
    calm: 'I’m here with you. We can take this one clear step at a time.',
    playful: 'Systems bright, imagination online. What are we making today?'
  }[personality];
}

async function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText || isResponding) return;
  isResponding = true;
  setPresence('thinking');
  sendButton.disabled = true;
  document.querySelectorAll('.suggestion').forEach(button => { button.disabled = true; });
  suggestions.classList.add('hidden');
  storedMessages.push({ text: cleanText, role: 'user' });
  logActivity(`Message sent in ${activeMode} mode`);
  saveMessages();
  addMessage(cleanText, 'user');
  messageInput.value = '';
  messageInput.style.height = 'auto';
  const typing = addMessage('Thinking...', 'maxi');
  try {
    const response = await askMaxi();
    typing.remove();
    storedMessages.push({ text: response, role: 'maxi' });
    saveMessages();
    addMessage(response, 'maxi');
  } catch (error) {
    typing.remove();
    const response = `I could not reach Gemini. ${error.message}. Open AI settings to check your API key and model.`;
    addMessage(response, 'maxi');
  } finally {
    setPresence('ready');
    isResponding = false;
    sendButton.disabled = false;
    document.querySelectorAll('.suggestion').forEach(button => { button.disabled = false; });
  }
}

function renderMemory() {
  memoryList.innerHTML = memories.length
    ? memories.map(memory => `<div class="memory-item">${escapeHtml(memory)}</div>`).join('')
    : '<div class="memory-item empty">No saved context yet.</div>';
  localStorage.setItem('maxi-memories', JSON.stringify(memories));
}

renderCurrentMessages();
renderMemory();
renderChatList();
modelInput.value = config.model;
apiKeyInput.value = config.apiKey;
personalityInput.value = config.personality;
greetingText.textContent = personalityGreeting(config.personality);
if (storedMessages.length) suggestions.classList.add('hidden');
updateConnectionStatus();

function updateConnectionStatus() {
  const ready = Boolean(config.apiKey && config.model);
  connectionStatus.textContent = ready ? `Gemini direct · ${config.model}` : 'Gemini key not configured';
  statusDot.classList.toggle('ready', ready);
}

function closeDrawers() {
  memoryDrawer.classList.remove('open');
  settingsDrawer.classList.remove('open');
  historyDrawer.classList.remove('open');
  memoryDrawer.setAttribute('aria-hidden', 'true');
  settingsDrawer.setAttribute('aria-hidden', 'true');
  historyDrawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.classList.remove('open');
  drawerBackdrop.setAttribute('aria-hidden', 'true');
}

const overlayTemplates = {
  pc: {
    title: 'PC bridge',
    html: '<div class="overlay-status"><span class="status-dot"></span><strong>Waiting for a secure PC agent</strong></div><p class="overlay-copy">Maxi can connect to your Windows computer later through an authenticated outbound bridge. Nothing on your PC is accessible yet.</p><div class="metric-grid"><div><span>CPU</span><strong>--</strong></div><div><span>RAM</span><strong>--</strong></div><div><span>GPU</span><strong>--</strong></div><div><span>Network</span><strong>--</strong></div></div><button class="panel-action" type="button" data-toast="PC bridge is not enabled yet">Request connection</button>'
  },
  voice: {
    title: 'Voice mode',
    html: '<div class="voice-orb"><span>◉</span></div><h3>Gemini Live ready</h3><p class="overlay-copy">Real-time voice input and spoken replies will live here. Choose a microphone and voice after the secure backend is connected.</p><button class="panel-action" type="button" data-toast="Voice mode is planned for the Gemini Live connection">Prepare voice session</button>'
  },
  vision: {
    title: 'Visual analysis',
    html: '<div class="drop-zone"><strong>Drop an image or file</strong><span>Screen capture and document analysis are permission-based.</span><button class="panel-action" type="button" data-toast="File analysis will be enabled with the Gemini backend">Choose file</button></div><p class="overlay-copy">Maxi will be able to explain screenshots, documents, code, logs, and data without silently accessing your devices.</p>'
  },
  plugins: {
    title: 'Capabilities',
    html: '<div class="plugin-row"><span class="plugin-mark">+</span><span><strong>Plugin system</strong><small>Extend Maxi with explicit capabilities</small></span><span class="plugin-state">PLANNED</span></div><div class="plugin-row"><span class="plugin-mark">↺</span><span><strong>Undo history</strong><small>Reverse approved actions</small></span><span class="plugin-state">PLANNED</span></div><div class="plugin-row"><span class="plugin-mark">⌁</span><span><strong>Audit trail</strong><small>See what Maxi did and why</small></span><span class="plugin-state">PLANNED</span></div>'
  },
  activity: {
    title: 'Activity log',
    html: '<div class="activity-list" id="activityList"></div><p class="overlay-copy">Only local session events are shown here. Remote PC actions will require authentication, permission, and an audit record.</p>'
  },
  briefing: {
    title: 'Morning briefing',
    html: '<div class="briefing-header"><span class="briefing-sun">☼</span><div><strong>Your day, at a glance</strong><small>Maxi will build this from your approved sources.</small></div></div><div class="briefing-item"><span>01</span><strong>Priorities</strong><em>Waiting for your calendar</em></div><div class="briefing-item"><span>02</span><strong>Weather</strong><em>Location permission not connected</em></div><div class="briefing-item"><span>03</span><strong>News pulse</strong><em>Research mode is ready</em></div><button class="panel-action" type="button" data-toast="Briefings will activate when sources are connected">Configure briefing</button>'
  },
  research: {
    title: 'Web research',
    html: '<div class="research-command"><span class="capability-icon">⌕</span><div><strong>Research mode</strong><small>Ask Maxi to compare sources and surface patterns.</small></div></div><div class="research-tags"><span>NEWS</span><span>COMPARE</span><span>PRICES</span><span>SOURCES</span></div><p class="overlay-copy">The current browser prototype does not browse on its own yet. The backend will add search providers, source links, and citation-aware answers.</p><button class="panel-action" type="button" data-toast="Research mode is selected; live web search is a backend capability">Start a research thread</button>'
  },
  games: {
    title: 'Games lounge',
    html: '<p class="overlay-copy">Choose a game. Maxi can play locally while keeping your chat and game scores on this device.</p><div class="game-menu"><button type="button" class="game-choice" data-game="ttt"><span>▦</span><strong>Tic-Tac-Toe</strong><small>Challenge Maxi</small></button><button type="button" class="game-choice" data-game="blackjack"><span>♠</span><strong>Blackjack</strong><small>Beat the dealer</small></button><button type="button" class="game-choice" data-game="tetris"><span>▤</span><strong>Tetris</strong><small>Keyboard arcade</small></button><button type="button" class="game-choice" data-game="poker"><span>♣</span><strong>Poker</strong><small>Texas Hold’em vs Maxi</small></button></div><div class="game-scoreline">LOCAL SCORE <b id="gameScore">0</b></div>'
  }
};

function openOverlay(key) {
  const template = overlayTemplates[key];
  if (!template) return;
  stopTetris();
  closeDrawers();
  overlayTitle.textContent = template.title;
  overlayContent.innerHTML = template.html;
  if (key === 'games') {
    overlayContent.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.game)));
    overlayContent.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
    overlayContent.querySelector('#gameScore').textContent = loadJson('maxi-game-score', 0);
  }
  if (key === 'activity') {
    const list = overlayContent.querySelector('#activityList');
    list.innerHTML = activityEvents.length
      ? activityEvents.slice().reverse().map(event => `<div class="activity-row"><span class="activity-pulse"></span><span>${escapeHtml(event.label)}</span><time>${event.time}</time></div>`).join('')
      : '<div class="activity-empty">No activity recorded yet.</div>';
  }
  overlayPanel.classList.add('open');
  overlayPanel.setAttribute('aria-hidden', 'false');
  overlayPanel.style.setProperty('--drag-x', '0px');
  overlayPanel.style.setProperty('--drag-y', '0px');
  overlayPanel.focus();
  overlayPanel.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
}

function openGame(game) {
  const content = game === 'ttt' ? ticTacToeMarkup() : game === 'blackjack' ? blackjackMarkup() : game === 'poker' ? pokerMarkup() : tetrisMarkup();
  overlayTitle.textContent = game === 'ttt' ? 'Tic-Tac-Toe' : game === 'blackjack' ? 'Blackjack' : game === 'poker' ? 'Poker' : 'Tetris';
  overlayContent.innerHTML = content;
  if (game === 'ttt') startTicTacToe();
  if (game === 'blackjack') startBlackjack();
  if (game === 'poker') startPoker();
  if (game === 'tetris') startTetris();
}

function ticTacToeMarkup() { return '<button class="game-back" type="button">‹ Games</button><p class="game-status" id="gameStatus">Your turn · You are X</p><div class="ttt-board" id="tttBoard">' + Array(9).fill('<button type="button" class="ttt-cell"></button>').join('') + '</div><button class="panel-action" id="resetGame" type="button">New round</button>'; }
function startTicTacToe() {
  const board = Array(9).fill(''); const cells = [...overlayContent.querySelectorAll('.ttt-cell')]; const status = overlayContent.querySelector('#gameStatus');
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = state => wins.find(line => line.every(index => state[index] === 'X')) ? 'X' : wins.find(line => line.every(index => state[index] === 'O')) ? 'O' : state.every(Boolean) ? 'draw' : null;
  const finish = (text, score = false) => { status.textContent = text; if (score) saveGameScore(); cells.forEach(cell => { cell.disabled = true; }); };
  const minimax = (state, maximizing) => { const result = winner(state); if (result === 'O') return 10; if (result === 'X') return -10; if (result === 'draw') return 0; const scores = state.map((value, index) => value ? null : index).filter(index => index !== null).map(index => { const next = [...state]; next[index] = maximizing ? 'O' : 'X'; return (maximizing ? minimax(next, false) : minimax(next, true)) + (maximizing ? -state.filter(Boolean).length : state.filter(Boolean).length); }); return maximizing ? Math.max(...scores) : Math.min(...scores); };
  const maxiMove = () => { const open = board.map((value, index) => value ? null : index).filter(index => index !== null); if (!open.length) return; let best = open[0]; let bestScore = -Infinity; open.forEach(index => { const next = [...board]; next[index] = 'O'; const score = minimax(next, false); if (score > bestScore) { bestScore = score; best = index; } }); board[best] = 'O'; cells[best].textContent = 'O'; cells[best].classList.add('o'); if (winner(board) === 'O') finish('Maxi wins this round.'); else if (winner(board) === 'draw') finish('Draw.'); else status.textContent = 'Your turn'; };
  cells.forEach((cell, index) => cell.addEventListener('click', () => { if (board[index]) return; board[index] = 'X'; cell.textContent = 'X'; cell.classList.add('x'); if (winner(board) === 'X') return finish('You win. Nice move.', true); if (winner(board) === 'draw') return finish('Draw.'); status.textContent = 'Maxi is thinking...'; window.setTimeout(maxiMove, 350); }));
  overlayContent.querySelector('#resetGame').addEventListener('click', () => openGame('ttt')); overlayContent.querySelector('.game-back').addEventListener('click', () => openOverlay('games'));
}
function blackjackMarkup() { return '<button class="game-back" type="button">‹ Games</button><div class="cards-area"><div><small>DEALER</small><div class="playing-cards" id="dealerCards"></div></div><div><small>YOU</small><div class="playing-cards" id="playerCards"></div></div></div><p class="game-status" id="gameStatus">Your move</p><div class="game-actions"><button class="panel-action" id="hitButton" type="button">Hit</button><button class="panel-action secondary-action" id="standButton" type="button">Stand</button></div>'; }
function startBlackjack() {
  let player = [card(), card()]; let dealer = [card(), card()]; const playerCards = overlayContent.querySelector('#playerCards'); const dealerCards = overlayContent.querySelector('#dealerCards'); const status = overlayContent.querySelector('#gameStatus');
  const render = reveal => { playerCards.innerHTML = player.map(value => `<span class="playing-card">${value}</span>`).join(''); dealerCards.innerHTML = dealer.map((value, index) => `<span class="playing-card">${index === 1 && !reveal ? '?' : value}</span>`).join(''); };
  const score = hand => hand.reduce((sum, value) => sum + Math.min(value, 10), 0); const end = text => { status.textContent = text; render(true); overlayContent.querySelectorAll('.game-actions button').forEach(button => { button.disabled = true; }); };
  const finish = () => { while (score(dealer) < 17) dealer.push(card()); const yours = score(player); const theirs = score(dealer); end(yours > 21 ? 'Bust. Dealer wins.' : theirs > 21 || yours > theirs ? 'You win.' : yours === theirs ? 'Push.' : 'Dealer wins.'); if (yours > 21 || theirs <= yours) saveGameScore(); };
  overlayContent.querySelector('#hitButton').addEventListener('click', () => { player.push(card()); render(false); if (score(player) > 21) finish(); }); overlayContent.querySelector('#standButton').addEventListener('click', finish); overlayContent.querySelector('.game-back').addEventListener('click', () => openOverlay('games')); render(false);
}
function card() { return Math.floor(Math.random() * 13) + 1; }
function pokerMarkup() { return '<button class="game-back" type="button">‹ Games</button><div class="poker-table"><div><small>MAXI</small><div class="playing-cards" id="pokerMaxiCards"></div></div><div class="poker-community" id="pokerCommunity"></div><div><small>YOU</small><div class="playing-cards" id="pokerPlayerCards"></div></div></div><p class="game-status" id="pokerStatus">Your move</p><div class="game-actions"><button class="panel-action" id="pokerCheck" type="button">Check</button><button class="panel-action secondary-action" id="pokerFold" type="button">Fold</button></div>'; }
function startPoker() {
  const suits = ['♠', '♥', '♦', '♣']; const deck = []; suits.forEach(suit => { for (let rank = 2; rank <= 14; rank += 1) deck.push({ rank, suit }); });
  for (let index = deck.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [deck[index], deck[swap]] = [deck[swap], deck[index]]; }
  const player = [deck.pop(), deck.pop()]; const maxi = [deck.pop(), deck.pop()]; const community = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()]; let revealed = 3; let finished = false;
  const rankName = rank => rank > 10 ? ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank]) : rank;
  const cardMarkup = currentCard => `<span class="playing-card">${rankName(currentCard.rank)}${currentCard.suit}</span>`;
  const scoreHand = cards => { const ranks = cards.map(currentCard => currentCard.rank).sort((a, b) => b - a); const counts = Object.values(cards.reduce((result, currentCard) => { result[currentCard.rank] = (result[currentCard.rank] || 0) + 1; return result; }, {})).sort((a, b) => b - a); const flush = new Set(cards.map(currentCard => currentCard.suit)).size === 1; const unique = [...new Set(ranks)]; const straight = unique.length >= 5 && unique.slice(0, 5).every((rank, index) => index === 0 || unique[index - 1] - rank === 1); if (straight && flush) return 8; if (counts[0] === 4) return 7; if (counts[0] === 3 && counts[1] >= 2) return 6; if (flush) return 5; if (straight) return 4; if (counts[0] === 3) return 3; if (counts[0] === 2 && counts[1] === 2) return 2; if (counts[0] === 2) return 1; return 0; };
  const handName = score => ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'][score];
  const render = revealMaxi => { document.querySelector('#pokerPlayerCards').innerHTML = player.map(cardMarkup).join(''); document.querySelector('#pokerMaxiCards').innerHTML = maxi.map((currentCard, index) => revealMaxi || index === 0 ? cardMarkup(currentCard) : '<span class="playing-card">?</span>').join(''); document.querySelector('#pokerCommunity').innerHTML = community.slice(0, revealed).map(cardMarkup).join(''); };
  const finish = outcome => { finished = true; render(true); document.querySelector('#pokerStatus').textContent = outcome; document.querySelector('#pokerCheck').disabled = true; document.querySelector('#pokerFold').disabled = true; };
  const showdown = () => { const playerScore = scoreHand([...player, ...community]); const maxiScore = scoreHand([...maxi, ...community]); finish(`You: ${handName(playerScore)} · Maxi: ${handName(maxiScore)} · ${playerScore > maxiScore ? 'You win.' : playerScore < maxiScore ? 'Maxi wins.' : 'Split pot.'}`); if (playerScore >= maxiScore) saveGameScore(); };
  document.querySelector('#pokerCheck').addEventListener('click', () => { if (finished) return; if (revealed < 5) { revealed += 1; render(false); document.querySelector('#pokerStatus').textContent = revealed === 5 ? 'Showdown' : 'Maxi calls · your move'; if (revealed === 5) showdown(); } });
  document.querySelector('#pokerFold').addEventListener('click', () => { if (!finished) finish('You folded. Maxi takes the pot.'); }); document.querySelector('.game-back').addEventListener('click', () => openOverlay('games')); render(false);
}
function tetrisMarkup() { return '<button class="game-back" type="button">‹ Games</button><p class="game-status" id="tetrisStatus">Tap Start, then use the controls</p><div class="tetris-stage"><div class="tetris-board" id="tetrisBoard"></div></div><div class="tetris-controls"><button type="button" data-tetris="left">←</button><button type="button" data-tetris="rotate">↻</button><button type="button" data-tetris="down">↓</button><button type="button" data-tetris="right">→</button></div><button class="panel-action" id="tetrisStart" type="button">Start Tetris</button>'; }
function startTetris() {
  window.clearInterval(tetrisTimer); if (tetrisKeyHandler) window.removeEventListener('keydown', tetrisKeyHandler);
  const boardElement = overlayContent.querySelector('#tetrisBoard'); const status = overlayContent.querySelector('#tetrisStatus'); const width = 10; const height = 20; const cells = Array(width * height).fill(0); const shapes = [[[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]]]; let piece; let running = false;
  boardElement.innerHTML = Array(width * height).fill('<i></i>').join(''); const squares = [...boardElement.children];
  const spawn = () => { piece = { shape: shapes[Math.floor(Math.random() * shapes.length)], x: 3, y: 0 }; if (collides(piece)) end(); };
  const blocks = item => item.shape.flatMap((row, y) => row.map((filled, x) => filled ? [item.x + x, item.y + y] : null).filter(Boolean));
  const collides = item => blocks(item).some(([x, y]) => x < 0 || x >= width || y >= height || (y >= 0 && cells[y * width + x]));
  const rotate = shape => shape[0].map((_, index) => shape.map(row => row[index]).reverse());
  const render = () => { squares.forEach((square, index) => { square.className = cells[index] ? 'filled' : ''; }); if (piece) blocks(piece).forEach(([x, y]) => { if (y >= 0) squares[y * width + x].className = 'active'; }); };
  const lock = () => { blocks(piece).forEach(([x, y]) => { if (y >= 0) cells[y * width + x] = 1; }); const kept = cells.filter(Boolean); while (kept.length < cells.length) kept.unshift(0); cells.splice(0, cells.length, ...kept); spawn(); };
  const step = () => { if (!running) return; const next = { ...piece, y: piece.y + 1 }; if (collides(next)) lock(); else piece = next; render(); };
  const move = direction => { const next = { ...piece, x: piece.x + direction }; if (!collides(next)) piece = next; render(); };
  const turn = () => { const next = { ...piece, shape: rotate(piece.shape) }; if (!collides(next)) piece = next; render(); };
  const end = () => { running = false; window.clearInterval(tetrisTimer); boardElement.classList.remove('running'); status.textContent = 'Game over · start a new run'; overlayContent.querySelector('#tetrisStart').textContent = 'Restart Tetris'; };
  const toggle = () => { if (running) { running = false; window.clearInterval(tetrisTimer); boardElement.classList.remove('running'); status.textContent = 'Paused'; return; } cells.fill(0); spawn(); running = true; boardElement.classList.add('running'); status.textContent = 'Running'; tetrisTimer = window.setInterval(step, 650); render(); overlayContent.querySelector('#tetrisStart').textContent = 'Pause Tetris'; };
  overlayContent.querySelector('#tetrisStart').addEventListener('click', toggle); overlayContent.querySelectorAll('[data-tetris]').forEach(button => button.addEventListener('click', () => { if (!piece) spawn(); if (button.dataset.tetris === 'left') move(-1); if (button.dataset.tetris === 'right') move(1); if (button.dataset.tetris === 'down') step(); if (button.dataset.tetris === 'rotate') turn(); }));
  tetrisKeyHandler = event => { if (!overlayPanel.classList.contains('open')) return; if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowDown') step(); if (event.code === 'Space') { event.preventDefault(); turn(); } }; window.addEventListener('keydown', tetrisKeyHandler); spawn(); render();
}
function saveGameScore() { const score = Number(loadJson('maxi-game-score', 0)) + 1; localStorage.setItem('maxi-game-score', score); }

function stopTetris() { window.clearInterval(tetrisTimer); if (tetrisKeyHandler) window.removeEventListener('keydown', tetrisKeyHandler); tetrisTimer = undefined; tetrisKeyHandler = undefined; }

function closeOverlay() {
  stopTetris();
  overlayPanel.classList.remove('open');
  overlayPanel.setAttribute('aria-hidden', 'true');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function setPresence(state) {
  presenceState.textContent = state.toUpperCase();
  presenceState.classList.remove('presence-flash');
  window.requestAnimationFrame(() => presenceState.classList.add('presence-flash'));
}

function updateSessionClock() {
  const elapsed = Math.floor((Date.now() - sessionStarted) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  sessionClock.textContent = `SESSION ${minutes}:${seconds}`;
}
window.setInterval(updateSessionClock, 1000);
updateSessionClock();

composer.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage(messageInput.value);
});
messageInput.addEventListener('input', () => {
  setPresence(messageInput.value.trim() ? 'composing' : 'ready');
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 100)}px`;
});
document.querySelectorAll('.suggestion').forEach(button => {
  button.addEventListener('click', () => sendMessage(button.textContent));
});
document.querySelectorAll('.mode-chip').forEach(button => {
  button.addEventListener('click', () => {
    activeMode = button.dataset.mode;
    setPresence(`${activeMode} mode`);
    document.querySelectorAll('.mode-chip').forEach(chip => chip.classList.toggle('active', chip === button));
    showToast(`${activeMode} mode active`);
  });
});
document.querySelectorAll('.capability-card').forEach(button => button.addEventListener('click', () => openOverlay(button.dataset.overlay)));
systemsToggle.addEventListener('click', () => {
  const expanded = capabilityGrid.classList.toggle('collapsed') === false;
  systemsToggle.setAttribute('aria-expanded', String(expanded));
  systemsToggle.querySelector('b').textContent = expanded ? '−' : '＋';
});
document.querySelector('#memoryButton').addEventListener('click', () => {
  setPresence('recalling');
  closeDrawers();
  memoryDrawer.classList.add('open');
  memoryDrawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.classList.add('open');
  drawerBackdrop.setAttribute('aria-hidden', 'false');
  memoryInput.focus();
});
document.querySelector('#historyButton').addEventListener('click', () => {
  closeDrawers();
  historyDrawer.classList.add('open');
  historyDrawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.classList.add('open');
  drawerBackdrop.setAttribute('aria-hidden', 'false');
  renderChatList();
});
document.querySelector('#closeHistory').addEventListener('click', closeHistory);
document.querySelector('#newChatButton').addEventListener('click', createChat);
document.querySelector('#clearAllChats').addEventListener('click', () => {
  chats = [{ id: crypto.randomUUID(), title: 'New conversation', messages: [], updatedAt: Date.now() }];
  currentChatId = chats[0].id;
  storedMessages = chats[0].messages;
  saveChats();
  renderCurrentMessages();
  renderChatList();
  closeHistory();
});
document.querySelector('#closeMemory').addEventListener('click', () => {
  closeDrawers();
});
memoryForm.addEventListener('submit', event => {
  event.preventDefault();
  const value = memoryInput.value.trim();
  if (!value) return;
  memories.push(value);
  logActivity('Memory updated');
  memoryInput.value = '';
  renderMemory();
});
document.querySelector('#clearMemory').addEventListener('click', () => {
  memories = [];
  renderMemory();
});
document.querySelector('#settingsButton').addEventListener('click', () => {
  setPresence('configuring');
  closeDrawers();
  settingsDrawer.classList.add('open');
  settingsDrawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.classList.add('open');
  drawerBackdrop.setAttribute('aria-hidden', 'false');
  apiKeyInput.focus();
});
document.querySelector('#closeSettings').addEventListener('click', () => {
  closeDrawers();
});
settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  config.personality = personalityInput.value;
  config.model = modelInput.value.trim();
  config.apiKey = apiKeyInput.value.trim();
  localStorage.setItem('maxi-ai-config', JSON.stringify(config));
  greetingText.textContent = personalityGreeting(config.personality);
  logActivity('Gemini connection settings saved');
  updateConnectionStatus();
  closeDrawers();
});
clearConversation.addEventListener('click', () => {
  storedMessages.splice(0, storedMessages.length);
  saveMessages();
  conversation.querySelectorAll('[data-dynamic="true"]').forEach(message => message.remove());
  suggestions.classList.remove('hidden');
  renderChatList();
  closeDrawers();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeDrawers();
    closeOverlay();
  }
});
drawerBackdrop.addEventListener('click', closeDrawers);
document.querySelector('#closeOverlay').addEventListener('click', closeOverlay);
document.querySelector('.overlay-drag-handle').addEventListener('pointerdown', event => {
  overlayDrag = { startX: event.clientX, startY: event.clientY, x: parseFloat(getComputedStyle(overlayPanel).getPropertyValue('--drag-x')) || 0, y: parseFloat(getComputedStyle(overlayPanel).getPropertyValue('--drag-y')) || 0 };
  overlayPanel.classList.add('dragging');
  event.currentTarget.setPointerCapture(event.pointerId);
});
document.querySelector('.overlay-drag-handle').addEventListener('pointermove', event => {
  if (!overlayDrag) return;
  const nextX = overlayDrag.x + event.clientX - overlayDrag.startX;
  const nextY = overlayDrag.y + event.clientY - overlayDrag.startY;
  overlayPanel.style.setProperty('--drag-x', `${Math.max(-window.innerWidth / 2, Math.min(window.innerWidth / 2, nextX))}px`);
  overlayPanel.style.setProperty('--drag-y', `${Math.max(-window.innerHeight / 3, Math.min(window.innerHeight / 3, nextY))}px`);
});
document.querySelector('.overlay-drag-handle').addEventListener('pointerup', () => { overlayDrag = null; overlayPanel.classList.remove('dragging'); });
document.querySelectorAll('.dock-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.dock-item').forEach(item => item.classList.toggle('active', item === button));
    if (button.dataset.dock === 'memory') document.querySelector('#memoryButton').click();
    if (button.dataset.dock === 'games') openOverlay('games');
    if (button.dataset.dock === 'settings') document.querySelector('#settingsButton').click();
    if (button.dataset.dock === 'dashboard') openOverlay('pc');
    if (button.dataset.dock === 'chat') { closeDrawers(); closeOverlay(); messageInput.focus(); }
  });
});
attachButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (file.type.startsWith('text/') || /\.(txt|md|json|csv|log)$/i.test(file.name)) {
    const content = await file.text();
    messageInput.value = `Review this file: ${file.name}\n\n${content.slice(0, 12000)}`;
    messageInput.dispatchEvent(new Event('input'));
    showToast(`${file.name} staged in the composer`);
  } else {
    messageInput.value = `I selected ${file.name}. Visual analysis will be available when Maxi's multimodal Gemini connection is enabled.`;
    messageInput.dispatchEvent(new Event('input'));
    showToast(`${file.name} staged for analysis`);
  }
  logActivity(`Attachment staged: ${file.name}`);
  fileInput.value = '';
});
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { isListening = true; voiceButton.classList.add('listening'); showToast('Listening...'); };
  recognition.onresult = event => { messageInput.value = Array.from(event.results).map(result => result[0].transcript).join(''); messageInput.dispatchEvent(new Event('input')); };
  recognition.onerror = () => showToast('Voice input could not start');
  recognition.onend = () => { isListening = false; voiceButton.classList.remove('listening'); };
  voiceButton.addEventListener('click', () => isListening ? recognition.stop() : recognition.start());
} else {
  voiceButton.addEventListener('click', () => showToast('Voice input is not supported in this browser'));
}
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
