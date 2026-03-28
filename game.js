// Main Game Engine

class PreyRunGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Game State
        this.running = false;
        this.paused = false;
        this.score = 0;
        this.distance = 50; // Distance between Lion and Deer (0-100)
        this.maxMisses = 4;
        this.missCount = 0;
        this.currentWord = null;
        this.inputBuffer = '';
        this.timer = 0;
        this.maxTime = 3000;
        this.lastTime = 0;
        this.lastWrongWord = null;
        this.practiceAudioBlob = null; // Lưu bản ghi âm để phát lại
        
        // Anime Assets
        this.processedDeer = null;
        this.processedLion = null;

        // Process images for transparency once loaded
        this.animeBg = new Image();
        
        this.animeDeer = new Image();
        this.animeDeer.onload = () => {
            this.processedDeer = this.removeWhiteBackground(this.animeDeer);
        };
        
        this.animeLion = new Image();
        this.animeLion.onload = () => {
            this.processedLion = this.removeWhiteBackground(this.animeLion);
        };

        this.animeRock = new Image();
        this.animeRock.onload = () => {
            this.processedRock = this.removeWhiteBackground(this.animeRock);
        };

        this.animeLog = new Image();
        this.animeLog.onload = () => {
            this.processedLog = this.removeWhiteBackground(this.animeLog);
        };

        this.animePuddle = new Image();
        this.animePuddle.onload = () => {
            this.processedPuddle = this.removeWhiteBackground(this.animePuddle);
        };

        // Gán src sau khi đã bind onload
        this.animeBg.src = 'anime_bg.png';
        this.animeDeer.src = 'anime_deer.png';
        this.animeLion.src = 'anime_lion.png';
        this.animeRock.src = 'rock_obstacle.png';
        this.animeLog.src = 'log_obstacle.png';
        this.animePuddle.src = 'puddle_obstacle.png';
        
        this.bgX = 0;

        // Remove HTML word elements, prepare Canvas word logic
        // this.wordEl and this.meaningEl no longer exist
        this.inputEl = document.getElementById('word-input');
        this.scoreEl = document.getElementById('current-score');
        this.distanceFillEl = document.getElementById('distance-fill');
        this.timerFillEl = document.getElementById('timer-fill');
        this.reHearBtn = document.getElementById('re-hear-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.speechContainer = document.getElementById('speech-container');
        this.speechStatus = document.getElementById('speech-status');
        this.speechResult = document.getElementById('speech-result');
        
        // Speech Recognition setup
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true;
            this.recognition.continuous = false;
            
            this.recognition.onresult = (event) => {
                // Bỏ qua kết quả nếu game đang tạm dừng
                if (this.paused) return;
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const text = event.results[i][0].transcript.trim().toLowerCase();
                    if (event.results[i].isFinal) final = text;
                    else interim = text;
                }
                const displayText = final || interim;
                if (this.speechResult) this.speechResult.innerText = displayText;
                
                if (final && this.currentWord) {
                    // So sánh với từ đúng
                    const correct = this.currentWord.word.toLowerCase();
                    if (final === correct || final.includes(correct) || correct.includes(final)) {
                        this.speechStatus.innerText = '✅ Đúng rồi!';
                        this.micBtn.classList.remove('mic-active');
                        this.isListening = false;
                        this.onCorrect();
                        setTimeout(() => this.nextWord(), 700);
                    } else {
                        this.speechStatus.innerText = `❌ Nghe được: "${final}" — thử lại!`;
                        this.micBtn.classList.remove('mic-active');
                        this.isListening = false;
                        this.onWrong();
                    }
                }
            };
            
            this.recognition.onerror = (e) => {
                if (this.speechStatus) {
                    if (e.error === 'no-speech') this.speechStatus.innerText = 'Không nghe thấy, thử lại...';
                    else this.speechStatus.innerText = 'Lỗi mic: ' + e.error;
                }
                this.micBtn.classList.remove('mic-active');
                this.isListening = false;
            };
            
            this.recognition.onend = () => {
                if (this.isListening) {
                    // Nếu vẫn đang chờ (chưa có kết quả) thì bật lại
                    try { this.recognition.start(); } catch(e) {}
                }
            };
        } else {
            this.recognition = null;
            console.warn('Trình duyệt không hỗ trợ Speech Recognition');
        }
        this.isListening = false;
        
        // Word Obstacle State
        this.wordObstacle = {
            active: false,
            text: '',
            meaning: '',
            yOffset: 0,
            opacity: 0,
            targetY: -100
        };
        
        // Input Listener for Typing mode
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });

        // Click Listener for MCQ mode
        document.querySelectorAll('.mcq-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.running || this.paused || !this.wordObstacle.active) return;
                const answer = e.target.dataset.word.toLowerCase();
                if (answer === this.currentWord.word.toLowerCase()) {
                    // Correct!
                    e.target.style.background = '#4CAF50';
                    e.target.style.color = 'white';
                    this.onCorrect();
                    this.nextWord();
                } else {
                    // Wrong!
                    e.target.style.background = '#FF5252';
                    e.target.style.color = 'white';
                    e.target.disabled = true;
                    this.onWrong();
                }
            });
        });

        this.reHearBtn.addEventListener('click', () => {
            if (this.currentWord) tts.speak(this.currentWord.word);
        });

        // Mic button for speech mode
        this.micBtn.addEventListener('click', () => {
            if (!this.running || this.paused || !this.wordObstacle.active) return;
            if (!this.recognition) {
                if (this.speechStatus) this.speechStatus.innerText = '❌ Trình duyệt không hỗ trợ! Hãy dùng Chrome.';
                return;
            }
            if (this.isListening) {
                this.isListening = false;
                try { this.recognition.stop(); } catch(e) {}
                this.micBtn.classList.remove('mic-active');
                this.speechStatus.innerText = 'Nhấn mic để nói tiếng Anh...';
            } else {
                this.isListening = true;
                this.speechResult.innerText = '';
                this.speechStatus.innerText = '🎙️ Đang nghe...';
                this.micBtn.classList.add('mic-active');
                try {
                    this.recognition.start();
                } catch(e) {
                    console.warn('Mic error:', e);
                    this.speechStatus.innerText = '❌ Lỗi mic: ' + e.message;
                    this.isListening = false;
                    this.micBtn.classList.remove('mic-active');
                }
            }
        });

        // Overlay Buttons
        document.getElementById('resume-btn').onclick = () => this.resume();
        document.getElementById('restart-btn').onclick = () => this.start();
        document.getElementById('retry-btn').onclick = () => this.start();
        document.getElementById('back-to-menu').onclick = () => this.quitToMenu();
        document.getElementById('menu-btn').onclick = () => this.quitToMenu();

        // Top Bar Buttons
        document.getElementById('pause-btn').addEventListener('click', () => {
            if (!this.running) return;
            if (this.paused) {
                this.resume();
            } else {
                this.paused = true;
                
                // Dừng speech recognition nếu đang nghe
                if (this.isListening && this.recognition) {
                    this.isListening = false;
                    try { this.recognition.stop(); } catch(e) {}
                    this.micBtn.classList.remove('mic-active');
                }
                
                // Dừng TTS nếu đang nói
                if (tts.synth.speaking) tts.synth.cancel();
                
                const overlay = document.getElementById('pause-overlay');
                overlay.classList.remove('hidden');
                
                // Hiển thị vùng rèn luyện nếu có từ sai
                const practiceArea = document.getElementById('practice-area');
                if (this.lastWrongWord) {
                    practiceArea.classList.remove('hidden');
                    document.getElementById('practice-word').innerText = this.lastWrongWord.word;
                    document.getElementById('practice-ipa').innerText = this.lastWrongWord.ipa || '';
                    document.getElementById('practice-tips').innerText = this.lastWrongWord.tips || 'Hãy nghe mẫu và thử phát âm lại chậm rãi.';
                } else {
                    practiceArea.classList.add('hidden');
                }
            }
            document.getElementById('pause-btn').textContent = this.paused ? '▶' : '⏸';
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            // Dừng game ngay lập tức không cần hỏi (confirm() lỗi trên mobile)
            document.getElementById('pause-btn').textContent = '⏸';
            this.quitToMenu();
        });

        document.getElementById('practice-speak-btn').onclick = () => {
            if (this.lastWrongWord) tts.speak(this.lastWrongWord.word);
        };

        document.getElementById('practice-record-btn').onclick = () => {
            this.startPracticeRecording();
        };

        document.getElementById('practice-playback-btn').onclick = () => {
            if (this.practiceAudioBlob) {
                const url = URL.createObjectURL(this.practiceAudioBlob);
                const audio = new Audio(url);
                audio.play();
            }
        };

        document.getElementById('practice-check-btn').onclick = () => {
            this.runPracticeCheck();
        };
    }

    resume() {
        this.paused = false;
        this.lastTime = 0; // Reset thời gian để tránh giật lag khi tiếp tục
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('pause-btn').textContent = '⏸';
        requestAnimationFrame((t) => this.loop(t)); // Chạy lại vòng lặp game
    }

    runPracticeCheck() {
        const checkBtn = document.getElementById('practice-check-btn');
        const resultEl = document.getElementById('practice-check-result');

        if (!this.recognition) {
            resultEl.style.cssText = 'color:#ff5252; background:rgba(255,0,0,0.1);';
            resultEl.innerText = '❌ Trình duyệt không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome.';
            return;
        }
        if (!this.lastWrongWord) return;

        const target = this.lastWrongWord.word.toLowerCase();

        // Tạo một SpeechRecognition riêng cho chế độ luyện tập
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const checkRec = new SpeechRecognition();
        checkRec.lang = 'en-US';
        checkRec.interimResults = false;
        checkRec.continuous = false;

        checkBtn.innerText = '🎙️ Đang nghe...';
        checkBtn.disabled = true;
        resultEl.style.cssText = 'color:#fff; background:rgba(255,255,255,0.05);';
        resultEl.innerText = 'Hãy nói từ đó...';

        checkRec.onresult = (event) => {
            const said = event.results[0][0].transcript.trim().toLowerCase();
            const confidence = Math.round(event.results[0][0].confidence * 100);

            if (said === target || said.includes(target) || target.includes(said)) {
                resultEl.style.cssText = 'color:#69f0ae; background:rgba(0,200,83,0.15); font-weight:bold;';
                resultEl.innerHTML = `✅ Đúng rồi! Bạn đã nói: "<b>${said}</b>" (${confidence}% chắc chắn)`;
            } else {
                resultEl.style.cssText = 'color:#ff5252; background:rgba(255,0,0,0.1); font-weight:bold;';
                resultEl.innerHTML = `❌ Nghe được: "<b>${said}</b>" — Từ cần nói: <b>${this.lastWrongWord.word}</b>`;
            }

            checkBtn.innerText = '🧪 Nói & Kiểm tra lại';
            checkBtn.disabled = false;
        };

        checkRec.onerror = (e) => {
            resultEl.style.cssText = 'color:#ffb300;';
            resultEl.innerText = e.error === 'no-speech' ? '⚠️ Không nghe thấy giọng, thử lại!' : '❌ Lỗi: ' + e.error;
            checkBtn.innerText = '🧪 Nói & Kiểm tra lại';
            checkBtn.disabled = false;
        };

        checkRec.start();
    }

    async startPracticeRecording() {
        const statusEl = document.getElementById('practice-record-status');
        const recordBtn = document.getElementById('practice-record-btn');
        const playbackBtn = document.getElementById('practice-playback-btn');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                this.practiceAudioBlob = new Blob(chunks, { type: 'audio/webm' });
                playbackBtn.disabled = false;
                statusEl.innerText = '✅ Xong! Nhấn ▶ để nghe lại phát âm của bạn.';
                recordBtn.innerText = '🎤 Ghi âm lại';
                recordBtn.disabled = false;
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            recordBtn.disabled = true;
            playbackBtn.disabled = true;

            // Đếm ngược 3 giây
            let secs = 3;
            statusEl.innerText = `🔴 Đang ghi... ${secs}s`;
            const countdown = setInterval(() => {
                secs--;
                if (secs > 0) {
                    statusEl.innerText = `🔴 Đang ghi... ${secs}s`;
                } else {
                    clearInterval(countdown);
                    recorder.stop();
                }
            }, 1000);

        } catch (err) {
            statusEl.innerText = '❌ Không thể truy cập Mic: ' + err.message;
        }
    }

    quitToMenu() {
        this.running = false;
        this.paused = false;
        
        // Dừng speech recognition nếu đang nghe
        if (this.isListening && this.recognition) {
            this.isListening = false;
            try { this.recognition.stop(); } catch(e) {}
            this.micBtn.classList.remove('mic-active');
        }
        
        // Dừng TTS
        if (tts.synth.speaking) tts.synth.cancel();
        
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('game-over-overlay').classList.add('hidden');
        showScreen('login-screen');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        this.running = true;
        this.paused = false;
        this.score = settingsDB.totalScore || 0;
        this.distance = settingsDB.startDistance || 50;
        this.maxMisses = settingsDB.maxMisses || 3;
        this.missCount = 0;
        this.lastWrongWord = null;
        this.gameSpeed = 5;
        this.rocks = [];
        this.explosions = [];
        this.deerAction = null;
        this.deerActionTimer = 0;
        this.lionAction = null;
        this.lionActionTimer = 0;
        
        this.scoreEl.innerText = this.score;
        this.updateLivesUI();
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('game-over-overlay').classList.add('hidden');
        this.nextWord();
        requestAnimationFrame((t) => this.loop(t));
    }

    updateLivesUI() {
        const livesLeft = this.maxMisses - this.missCount;
        let hearts = '';
        for(let i=0; i<livesLeft; i++) hearts += '♥️';
        for(let i=0; i<this.missCount; i++) hearts += '🖤';
        document.getElementById('lives-display').innerText = hearts;
    }

    nextWord() {
        // Fade out old word
        this.wordObstacle.active = false;
        
        setTimeout(() => {
            this.currentWord = vocabDB.getRandomWord();
            // Handle Game Mode Interface
            if (settingsDB.gameMode === 'mcq') {
                this.inputEl.style.display = 'none';
                const mcqContainer = document.getElementById('mcq-container');
                mcqContainer.classList.remove('hidden');
                mcqContainer.style.display = 'flex';
                
                const wrongWords = vocabDB.getWrongWords(this.currentWord.id, 3);
                const options = [this.currentWord, ...wrongWords];
                options.sort(() => Math.random() - 0.5); // Xáo trộn

                const btns = document.querySelectorAll('.mcq-btn');
                btns.forEach((btn, idx) => {
                    const opt = options[idx];
                    if (opt) {
                        btn.innerText = opt.word;
                        btn.dataset.word = opt.word;
                        btn.disabled = false;
                        btn.style.background = '';
                        btn.style.color = '';
                        btn.style.visibility = 'visible';
                    } else {
                        btn.style.visibility = 'hidden';
                    }
                });
            } else if (settingsDB.gameMode === 'speech') {
                // --- SPEECH MODE ---
                this.inputEl.style.display = 'none';
                document.getElementById('mcq-container').style.display = 'none';
                this.speechContainer.classList.remove('hidden');
                this.speechContainer.style.display = 'flex';
                this.micBtn.classList.remove('hidden');
                this.speechResult.innerText = '';
                this.speechStatus.innerText = 'Nhấn 🎤 Nói để phát âm tiếng Anh...';
                // Không tự động bật mic vì trình duyệt yêu cầu user nhấn nút trực tiếp
                this.isListening = false;
                this.micBtn.classList.remove('mic-active');
            } else {
                // --- TYPING MODE ---
                this.inputEl.style.display = 'block';
                document.getElementById('mcq-container').style.display = 'none';
                this.speechContainer.style.display = 'none';
                this.speechContainer.classList.add('hidden');
                this.micBtn.classList.add('hidden');
                this.inputEl.value = '';
                this.inputEl.focus();
            }
            
            // Set maxTime based on settings
            const lvlTime = settingsDB.levelTimes[this.currentWord.level] || 3;
            this.maxTime = lvlTime * 1000;
            this.timer = this.maxTime;
            
            // Show new word
            this.wordObstacle.text = this.currentWord.word;
            this.wordObstacle.meaning = this.currentWord.meaning;
            this.wordObstacle.yOffset = 50; // Start lower
            this.wordObstacle.opacity = 0;
            this.wordObstacle.targetY = 0; // Float up to normal position
            this.wordObstacle.active = true;
            
            tts.speak(this.currentWord.word);
        }, 300);
    }

    checkAnswer() {
        if (!this.running || this.paused || !this.wordObstacle.active) return;

        const answer = this.inputEl.value.trim().toLowerCase();
        if (answer === this.currentWord.word.toLowerCase()) {
            this.onCorrect();
            this.nextWord();
        } else {
            this.onWrong();
            this.inputEl.value = '';
        }
    }

    onCorrect() {
        this.score = Number(this.score) + 1;
        settingsDB.totalScore = this.score;
        settingsDB.save();
        this.scoreEl.innerText = this.score;
        this.distance = Math.min(100, this.distance + 8);
        this.gameSpeed += 0.1;
        
        // Spawn obstacle (random type)
        const obstacleTypes = ['rock', 'log', 'puddle'];
        const chosenType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        this.rocks.push({
            x: this.canvas.width + 50, 
            y: this.canvas.height * 0.93,
            type: chosenType,
            action: 'correct',
            deerPassed: false,
            lionPassed: false
        });
    }

    onWrong() {
        this.score = Math.max(0, Number(this.score) - 2);
        settingsDB.totalScore = this.score;
        settingsDB.save();
        this.scoreEl.innerText = this.score;
        this.distance -= 12;
        this.missCount++;
        this.lastWrongWord = this.currentWord; // Lưu từ vừa sai
        this.updateLivesUI();
        
        const obstacleTypes2 = ['rock', 'log', 'puddle'];
        const wrongType = obstacleTypes2[Math.floor(Math.random() * obstacleTypes2.length)];
        this.rocks.push({
            x: this.canvas.width + 50, 
            y: this.canvas.height * 0.93,
            type: wrongType,
            action: 'wrong',
            deerPassed: false,
            lionPassed: false
        });

        if (this.distance <= 0 || this.missCount >= this.maxMisses) {
            this.gameOver();
        }
    }

    gameOver() {
        this.running = false;
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    loop(timestamp) {
        if (!this.running) return;
        if (this.paused) {
            this.lastTime = 0; // Reset để tránh giật khi resume
            return;
        }

        const deltaTime = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;

        // Giới hạn deltaTime để tránh giật khi tab bị ẩn
        const clampedDt = Math.min(deltaTime, 100);

        this.update(clampedDt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        const speedMultiplier = this.gameSpeed / 5;
        const fpsCorrect = dt / 16;
        
        // Update background
        this.bgX -= 3 * speedMultiplier * fpsCorrect;
        if (this.bgX <= -this.canvas.width) {
            this.bgX = 0;
        }

        // Action mechanics (Rocks & Explosions)
        const scrollSpeed = 3 * speedMultiplier * fpsCorrect;
        if (this.deerActionTimer > 0) {
            this.deerActionTimer -= fpsCorrect;
            if (this.deerActionTimer <= 0) this.deerAction = null;
        }
        if (this.lionActionTimer > 0) {
            this.lionActionTimer -= fpsCorrect;
            if (this.lionActionTimer <= 0) this.lionAction = null;
        }

        const deerXNum = this.canvas.width * 0.65;
        const lionXNum = deerXNum - (this.distance * 6);

        if (this.rocks) {
            this.rocks.forEach(r => {
                r.x -= scrollSpeed; // Đồng bộ 100% với tốc độ Background
                if (!r.deerPassed && r.x < deerXNum + 80) {
                    if (r.action === 'correct') {
                        this.deerAction = 'jump';
                        this.deerActionTimer = 35;
                    } else {
                        this.deerAction = 'trip';
                        this.deerActionTimer = 35;
                        if(!this.explosions) this.explosions = [];
                        this.explosions.push({ x: deerXNum, y: this.canvas.height * 0.93, timer: 30 });
                    }
                    r.deerPassed = true;
                }
                if (!r.lionPassed && r.x < lionXNum + 60) {
                    if (r.action === 'correct') {
                        this.lionAction = 'trip';
                        this.lionActionTimer = 35;
                        if(!this.explosions) this.explosions = [];
                        this.explosions.push({ x: lionXNum, y: this.canvas.height * 0.93, timer: 30 });
                    } else {
                        this.lionAction = 'jump';
                        this.lionActionTimer = 35;
                    }
                    r.lionPassed = true;
                }
            });
            this.rocks = this.rocks.filter(r => r.x > -100);
        }

        if (this.explosions) {
            this.explosions.forEach(e => {
                e.x -= scrollSpeed;
                e.timer -= fpsCorrect;
            });
            this.explosions = this.explosions.filter(e => e.timer > 0);
        }

        // Timer reduction
        if (this.wordObstacle.active) {
            this.timer -= dt;
            this.timerFillEl.style.width = (this.timer / this.maxTime) * 100 + '%';
            if (this.timer <= 0) {
                this.onWrong();
                this.nextWord();
            }
            
            // Animate word obstacle
            this.wordObstacle.yOffset += (this.wordObstacle.targetY - this.wordObstacle.yOffset) * 0.1;
            this.wordObstacle.opacity = Math.min(1, this.wordObstacle.opacity + 0.1);
        } else {
            // Fade out animation
            this.wordObstacle.targetY = -50;
            this.wordObstacle.yOffset += (this.wordObstacle.targetY - this.wordObstacle.yOffset) * 0.1;
            this.wordObstacle.opacity = Math.max(0, this.wordObstacle.opacity - 0.1);
        }

        // UI Distance bar (100% means very far, 0 means caught)
        this.distanceFillEl.style.width = this.distance + '%';
    }

    removeWhiteBackground(img) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);
        
        try {
            const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Xóa nền trắng/xám (Chroma key)
                if (data[i] > 235 && data[i+1] > 235 && data[i+2] > 235) {
                    data[i+3] = 0; // Trong suốt
                }
            }
            offCtx.putImageData(imageData, 0, 0);
            return offCanvas;
        } catch (e) {
            return img; // Lỗi CORS hoặc mượt -> fall back
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Anime Background (Seamless loop - Mirrored for perfect seam)
        const cW = this.canvas.width;
        const cH = this.canvas.height;
        if (this.animeBg.complete && this.animeBg.naturalWidth > 0) {
            const ratio = this.animeBg.naturalWidth / this.animeBg.naturalHeight;
            let drawH = cH;
            let drawW = drawH * ratio;
            
            // Đảm bảo drawW không quá nhỏ
            if (drawW < cW) {
                drawW = cW;
                drawH = drawW / ratio;
            }

            // Reset loop khi cuộn hết 2 khung hình (ảnh gốc + ảnh lật)
            const loopWidth = drawW * 2;
            let currentX = this.bgX % loopWidth;
            if (currentX > 0) currentX -= loopWidth; // Đảm bảo currentX luôn <= 0

            // Khung 1: Ảnh gốc
            this.ctx.drawImage(this.animeBg, currentX, cH - drawH, drawW, drawH);
            
            // Khung 2: Ảnh lật gương (tạo seamless hoàn hảo)
            this.ctx.save();
            this.ctx.translate(currentX + drawW * 2, 0);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.animeBg, 0, cH - drawH, drawW, drawH);
            this.ctx.restore();

            // Khung 3: Lặp lại ảnh gốc nếu mép trái hở
            if (currentX + loopWidth < cW) {
                this.ctx.drawImage(this.animeBg, currentX + loopWidth, cH - drawH, drawW, drawH);
            }

        } else {
            // Fallback gradient
            const grad = this.ctx.createLinearGradient(0, 0, 0, cH);
            grad.addColorStop(0, '#87CEEB');
            grad.addColorStop(0.6, '#98FB98');
            grad.addColorStop(1, '#228B22');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, cW, cH);
        }

        const groundY = this.canvas.height * 0.93; // Lên 5% từ 0.98
        const deerX = this.canvas.width * 0.65;
        const lionX = deerX - (this.distance * 6);

        // Hiệu ứng "chạy" (stretch & squash)
        const speedMultiplier = this.gameSpeed / 5;
        const runCycle = (Date.now() / 150 * speedMultiplier) % (Math.PI * 2);
        const stretchW = Math.sin(runCycle) * 0.1;
        const stretchH = -Math.sin(runCycle) * 0.15;

        // Draw Rocks
        if (this.rocks) {
            this.rocks.forEach(r => {
                let img = null;
                let rW = 90, rH = 90;
                if (r.type === 'rock') img = this.processedRock;
                else if (r.type === 'log') { img = this.processedLog; rW = 130; rH = 60; }
                else if (r.type === 'puddle') { img = this.processedPuddle; rW = 120; rH = 50; }

                if (img) {
                    this.ctx.drawImage(img, r.x - rW/2, r.y - rH, rW, rH);
                } else {
                    this.ctx.font = '50px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'bottom';
                    const fallback = r.type === 'log' ? '🪵' : r.type === 'puddle' ? '💧' : '🪨';
                    this.ctx.fillText(fallback, r.x, r.y);
                }
            });
        }

        // Draw Explosions / Stars
        if (this.explosions) {
            this.explosions.forEach(e => {
                this.ctx.save();
                this.ctx.globalAlpha = Math.max(0, e.timer / 30);
                this.ctx.font = '60px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText('💫', e.x, e.y - 80);
                this.ctx.restore();
            });
        }

        // VẼ SƯ TỬ
        this.ctx.save();
        this.ctx.translate(lionX, groundY);
        let lionJump = Math.abs(Math.sin(runCycle * 2)) * 12;
        let lionRot = 0;
        if (this.lionAction === 'trip') {
            const p = this.lionActionTimer / 35; // 1 -> 0
            lionRot = Math.sin(p * Math.PI) * -1.2; // Vấp chúi
            lionJump += Math.sin(p * Math.PI) * 40;
        } else if (this.lionAction === 'jump') {
            const p = this.lionActionTimer / 35; 
            lionJump += Math.sin(p * Math.PI) * 180; 
            lionRot = (p - 0.5) * 0.4; 
        }
        
        this.ctx.rotate(lionRot);
        this.ctx.scale(1 + stretchW, 1 + stretchH);
        const lionW = 165, lionH = 132;
        if (this.processedLion) {
            this.ctx.drawImage(this.processedLion, -lionW / 2, -lionH - lionJump, lionW, lionH);
        } else {
            this.ctx.font = '70px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText('🦁', 0, -lionJump);
        }
        this.ctx.restore();

        // VẼ NAI
        this.ctx.save();
        this.ctx.translate(deerX, groundY);
        let deerJump = Math.abs(Math.sin(runCycle * 1.5)) * 8;
        let deerRot = 0;
        if (this.deerAction === 'jump') {
            const p = this.deerActionTimer / 35; // 1 -> 0
            deerJump += Math.sin(p * Math.PI) * 180; // Nhảy tưng qua đá
            deerRot = (p - 0.5) * 0.4; // Hơi nghiêng người
        } else if (this.deerAction === 'trip') {
            const p = this.deerActionTimer / 35; 
            deerRot = Math.sin(p * Math.PI) * -1.2; // Vấp sấp mặt
            deerJump += Math.sin(p * Math.PI) * 40;
        }
        
        this.ctx.rotate(deerRot);
        this.ctx.scale(1 + stretchW, 1 + stretchH);
        const deerW = 165, deerH = 132;
        if (this.processedDeer) {
            this.ctx.drawImage(this.processedDeer, -deerW / 2, -deerH - deerJump, deerW, deerH);
        } else {
            this.ctx.font = '60px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText('🦌', 0, -deerJump);
        }
        this.ctx.restore();
        
        // Draw Word Obstacle
        if (this.wordObstacle.opacity > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = this.wordObstacle.opacity;
            const wordX = this.canvas.width / 2;
            const wordY = this.canvas.height * 0.45 + this.wordObstacle.yOffset; // Bồng bềnh trên trời

            if (!settingsDB.hideEnglishWord) {
                this.ctx.font = 'bold 72px Outfit, sans-serif'; 
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
                this.ctx.fillText(this.wordObstacle.text.toUpperCase(), wordX + 2, wordY + 2);
                this.ctx.fillStyle = '#FFEB3B';
                this.ctx.fillText(this.wordObstacle.text.toUpperCase(), wordX, wordY);
            }

            this.ctx.font = '26px Outfit, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            // Đẩy chữ tiếng Việt lên một chút nếu ẩn tiếng Anh để cân đối
            const meaningY = settingsDB.hideEnglishWord ? wordY : wordY + 50;
            this.ctx.fillText(this.wordObstacle.meaning, wordX, meaningY);
            this.ctx.restore();
        }

        // Draw Countdown Circle
        if (this.wordObstacle.active && this.maxTime > 0) {
            const progress = this.timer / this.maxTime;
            const cx = this.canvas.width - 60, cy = 60, r = 40;

            // Background circle
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.fill();

            // Countdown arc
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
            this.ctx.strokeStyle = progress > 0.4 ? '#4CAF50' : '#FF5252';
            this.ctx.lineWidth = 8;
            this.ctx.stroke();

            // Number
            this.ctx.font = 'bold 22px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(Math.ceil(this.timer / 1000), cx, cy);
        }
    }
}

window.gameInstance = new PreyRunGame();
