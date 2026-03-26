// Vocabulary Management & TTS Integration

class VocabularyDB {
    constructor() {
        this.key = 'prey_run_words';
        this.defaultWords = [
            { id: 1, word: 'Lion', meaning: 'Sư tử', level: 'Beginner', ipa: '/ˈlaɪ.ən/', tips: 'Âm "ai" như trong "light", nhấn mạnh âm đầu.' },
            { id: 2, word: 'Deer', meaning: 'Con nai', level: 'Beginner', ipa: '/dɪər/', tips: 'Âm "ee" kéo dài, lưỡi hơi cong ở âm "r".' },
            { id: 3, word: 'Forest', meaning: 'Rừng rậm', level: 'Beginner', ipa: '/ˈfɒr.ɪst/', tips: 'Âm "o" ngắn, âm "est" đọc nhanh.' },
            { id: 4, word: 'Escape', meaning: 'Chạy trốn', level: 'Intermediate', ipa: '/ɪˈskeɪp/', tips: 'Âm "ay" như trong "say", kết thúc bằng môi mím lại cho âm "p".' },
            { id: 5, word: 'Predator', meaning: 'Thú săn mồi', level: 'Advanced', ipa: '/ˈpred.ə.tər/', tips: 'Nhấn âm "Pre", âm cuối "tor" đọc nhẹ như "tơ".' }
        ];
        this.words = this.loadWords();
    }

    loadWords() {
        try {
            const stored = localStorage.getItem(this.key);
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.warn("LocalStorage blocked. Using default words temporary.");
        }
        return this.defaultWords; // Do not attempt to save if it failed
    }

    saveWords(words) {
        try {
            localStorage.setItem(this.key, JSON.stringify(words));
        } catch (e) {
            console.warn("Cannot save to LocalStorage: ", e);
        }
        this.words = words;
    }

    addWord(word, meaning, level, ipa = '', tips = '') {
        const newWord = {
            id: Date.now(),
            word: word.trim(),
            meaning: meaning.trim(),
            level: level,
            ipa: ipa.trim(),
            tips: tips.trim()
        };
        const words = [...this.words, newWord];
        this.saveWords(words);
        return newWord;
    }

    deleteWord(id) {
        const words = this.words.filter(w => w.id !== id);
        this.saveWords(words);
    }

    getRandomWord() {
        if (this.words.length === 0) return this.defaultWords[0];
        
        let filtered = this.words;
        if (settingsDB && settingsDB.selectedLevel !== 'all') {
            filtered = this.words.filter(w => w.level === settingsDB.selectedLevel);
        }
        if (filtered.length === 0) filtered = this.words;

        return filtered[Math.floor(Math.random() * filtered.length)];
    }

    getWrongWords(correctId, count) {
        let pool = this.words;
        if (settingsDB && settingsDB.selectedLevel !== 'all') {
            pool = this.words.filter(w => w.level === settingsDB.selectedLevel);
        }
        if (pool.length < count + 1) pool = this.words; // Fallback to all words if not enough

        let wrongs = pool.filter(w => w.id !== correctId);
        
        // Shuffle and slice
        wrongs.sort(() => Math.random() - 0.5);
        if (wrongs.length < count) {
            // Very edge case: user only has 1 word total in DB. Just duplicate it for options
            while(wrongs.length < count) {
                wrongs.push(this.defaultWords[Math.floor(Math.random() * this.defaultWords.length)]);
            }
        }
        return wrongs.slice(0, count);
    }

    exportJSON() {
        const dataStr = JSON.stringify(this.words, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'vocabulary_backup.json';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const words = JSON.parse(e.target.result);
                if (Array.isArray(words)) {
                    this.saveWords(words);
                    renderWordList(); // Needs access to ui.js function or via event
                    alert('Đã khôi phục dữ liệu thành công!');
                }
            } catch (err) {
                alert('Tập tin không hợp lệ!');
            }
        };
        reader.readAsText(file);
    }
}

class TTSManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        
        // Wait for voices to load
        this.synth.onvoiceschanged = () => {
            const voices = this.synth.getVoices();
            // Default to an English voice
            this.voice = voices.find(v => v.lang.includes('en-US')) || voices.find(v => v.lang.includes('en'));
        };
    }

    speak(text) {
        if (this.synth.speaking) this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.rate;
        this.synth.speak(utterance);
    }

    setVoice(langCode) {
        const voices = this.synth.getVoices();
        this.voice = voices.find(v => v.lang.includes(langCode)) || voices[0];
    }
}

class SettingsDB {
    constructor() {
        this.load();
    }

    load() {
        let d = {};
        try {
            d = JSON.parse(localStorage.getItem('prey_run_settings') || '{}');
        } catch (e) {
            console.warn("Settings LocalStorage blocked.");
        }
        
        this.selectedLevel = d.selectedLevel || 'all';
        this.levelTimes = d.levelTimes || {
            'Beginner': 4,
            'Intermediate': 3,
            'Advanced': 2.5
        };
        this.hideEnglishWord = d.hideEnglishWord || false;
        this.totalScore = d.totalScore || 0;
        this.gameMode = d.gameMode || 'typing';
        this.maxMisses = d.maxMisses || 3;
        this.startDistance = Math.min(100, Math.max(10, d.startDistance || 50));
    }

    save() {
        try {
            localStorage.setItem('prey_run_settings', JSON.stringify({
                selectedLevel: this.selectedLevel,
                levelTimes: this.levelTimes,
                hideEnglishWord: this.hideEnglishWord,
                totalScore: this.totalScore,
                gameMode: this.gameMode,
                maxMisses: this.maxMisses,
                startDistance: this.startDistance
            }));
        } catch (e) {
            console.warn("Cannot save Settings to LocalStorage.");
        }
    }
}

const settingsDB = new SettingsDB();
const vocabDB = new VocabularyDB();
const tts = new TTSManager();
