// UI Interactions & Screen Management

const passwordCorrect = "1234"; // Mật mã cứng

// Elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const adminPanel = document.getElementById('admin-panel');
const adminPassInput = document.getElementById('admin-pass');
const loginBtn = document.getElementById('login-btn');
const startGameBtn = document.getElementById('start-game-btn');
const closeAdminBtn = document.getElementById('close-admin');
const wordTableBody = document.getElementById('word-table-body');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsBackBtn = document.getElementById('settings-back-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingGameLevel = document.getElementById('setting-game-level');
const timeBeginner = document.getElementById('time-Beginner');
const timeIntermediate = document.getElementById('time-Intermediate');
const timeAdvanced = document.getElementById('time-Advanced');
const settingHideWord = document.getElementById('setting-hide-word');
const modeTyping = document.getElementById('mode-typing');
const modeMcq = document.getElementById('mode-mcq');
const modeSpeech = document.getElementById('mode-speech');
const settingLives = document.getElementById('setting-lives');
const settingDistance = document.getElementById('setting-distance');

// Admin Form Elements
const newWordInput = document.getElementById('new-word');
const newMeaningInput = document.getElementById('new-meaning');
const newLevelSelect = document.getElementById('new-level');
const addWordBtn = document.getElementById('add-word-btn');

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'admin-panel') {
        renderWordList();
    }
}

// Login Logic
loginBtn.addEventListener('click', () => {
    if (adminPassInput.value === passwordCorrect) {
        showScreen('admin-panel');
    } else {
        alert('Sai mật mã!');
    }
});

startGameBtn.addEventListener('click', () => {
    // Show game screen first, then show level select overlay
    showScreen('game-screen');
    document.getElementById('level-select-overlay').classList.remove('hidden');
});

// Level Select buttons
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        settingsDB.selectedLevel = btn.dataset.level;
        settingsDB.save();
        document.getElementById('level-select-overlay').classList.add('hidden');
        if (window.gameInstance) window.gameInstance.start();
    });
});

document.getElementById('level-cancel-btn').addEventListener('click', () => {
    document.getElementById('level-select-overlay').classList.add('hidden');
    showScreen('login-screen');
});

closeAdminBtn.addEventListener('click', () => {
    showScreen('login-screen');
});

// Settings Logic
settingsBtn.addEventListener('click', () => {
    // Load current settings into inputs
    settingGameLevel.value = settingsDB.selectedLevel;
    timeBeginner.value = settingsDB.levelTimes['Beginner'] || 4;
    timeIntermediate.value = settingsDB.levelTimes['Intermediate'] || 3;
    timeAdvanced.value = settingsDB.levelTimes['Advanced'] || 2.5;
    settingHideWord.checked = settingsDB.hideEnglishWord || false;
    
    if (settingsDB.gameMode === 'mcq') {
        modeMcq.checked = true;
    } else if (settingsDB.gameMode === 'speech') {
        modeSpeech.checked = true;
    } else {
        modeTyping.checked = true;
    }
    
    settingLives.value = settingsDB.maxMisses || 3;
    settingDistance.value = settingsDB.startDistance || 50;

    showScreen('settings-screen');
});

settingsBackBtn.addEventListener('click', () => {
    showScreen('login-screen');
});

saveSettingsBtn.addEventListener('click', () => {
    settingsDB.selectedLevel = settingGameLevel.value;
    settingsDB.levelTimes['Beginner'] = parseFloat(timeBeginner.value) || 4;
    settingsDB.levelTimes['Intermediate'] = parseFloat(timeIntermediate.value) || 3;
    settingsDB.levelTimes['Advanced'] = parseFloat(timeAdvanced.value) || 2.5;
    settingsDB.hideEnglishWord = settingHideWord.checked;
    settingsDB.gameMode = modeMcq.checked ? 'mcq' : modeSpeech.checked ? 'speech' : 'typing';
    settingsDB.maxMisses = parseInt(settingLives.value) || 3;
    settingsDB.startDistance = parseInt(settingDistance.value) || 50;
    
    settingsDB.save();
    alert('Đã lưu cài đặt game!');
    showScreen('login-screen');
});

// Admin Panel CRUD
function renderWordList() {
    wordTableBody.innerHTML = '';
    vocabDB.words.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${w.word}</td>
            <td>${w.meaning}</td>
            <td><small>${w.ipa || ''}</small></td>
            <td>${w.level}</td>
            <td><button class="delete-btn" data-id="${w.id}">Xóa</button></td>
        `;
        wordTableBody.appendChild(tr);
    });

    // Gắn sự kiện Delete riêng biệt thay vì dùng string onclick
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (confirm('Bạn có chắc muốn xóa từ này?')) {
                vocabDB.deleteWord(id);
                renderWordList();
            }
        });
    });
}

addWordBtn.addEventListener('click', () => {
    const word = newWordInput.value;
    const meaning = newMeaningInput.value;
    const level = newLevelSelect.value;
    const ipa = document.getElementById('new-ipa').value;
    const tips = document.getElementById('new-tips').value;
    
    if (word && meaning) {
        vocabDB.addWord(word, meaning, level, ipa, tips);
        newWordInput.value = '';
        newMeaningInput.value = '';
        document.getElementById('new-ipa').value = '';
        document.getElementById('new-tips').value = '';
        renderWordList();
    } else {
        alert('Vui lòng nhập đầy đủ thông tin!');
    }
});

// Export/Import Logic
exportBtn.addEventListener('click', () => {
    vocabDB.exportJSON();
});

importBtn.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        vocabDB.importJSON(e.target.files[0]);
    }
});
