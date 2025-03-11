// Get API key from server
let API_KEY = 'DEMO_KEY';
fetch('/api/config')
    .then(response => response.json())
    .then(config => {
        API_KEY = config.apiKey;
        console.log('API key loaded successfully');
    })
    .catch(error => {
        console.error('Error loading API key:', error);
    });

const API_URL = 'https://api.wordnik.com/v4/words.json/randomWord';

const gameContainer = document.getElementById("game-container");
const wordInput = document.getElementById("word-input");
const scoreDisplay = document.getElementById("score");
const gameOverScreen = document.getElementById("game-over");

// Game settings
const DIFFICULTY_SETTINGS = {
    EASY: { speed: 1, interval: 2500, scoreMultiplier: 1 },
    MEDIUM: { speed: 1.5, interval: 2000, scoreMultiplier: 2 },
    HARD: { speed: 2, interval: 1800, scoreMultiplier: 3 }
};

// Audio system
const AUDIO = {
    bgMusic: new Audio('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'),
    type: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-single-key-press-in-a-laptop-2541.mp3'),
    success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3'),
    powerup: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3'),
    achievement: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'),
    gameOver: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-retro-arcade-game-over-470.mp3')
};

// Audio state management
let audioInitialized = false;
let isMuted = false;

// Initialize audio system
const initAudio = () => {
    if (audioInitialized) return;
    
    Object.values(AUDIO).forEach(audio => {
        audio.load();
        if (audio === AUDIO.bgMusic) {
            audio.volume = 0.4; // Slightly increased volume for the new track
            audio.loop = true;
        } else {
            audio.volume = 0.5;
        }
    });
    
    audioInitialized = true;
};

// Enhanced play sound function
const playSound = (soundName) => {
    if (!audioInitialized || isMuted || !AUDIO[soundName]) return;
    
    const sound = AUDIO[soundName];
    
    // Create a new audio element for overlapping sounds
    if (soundName === 'type' || soundName === 'success') {
        const clone = sound.cloneNode();
        clone.volume = sound.volume;
        clone.play().catch(err => console.log('Audio play failed:', err));
        // Clean up cloned audio element after it's done
        clone.onended = () => clone.remove();
    } else {
        sound.currentTime = 0;
        sound.play().catch(err => console.log('Audio play failed:', err));
    }
};

// Enhanced toggle audio function
const toggleAudio = () => {
    if (!audioInitialized) return;
    
    isMuted = !isMuted;
    Object.values(AUDIO).forEach(audio => {
        audio.muted = isMuted;
    });
    
    if (!isMuted && !AUDIO.bgMusic.playing) {
        AUDIO.bgMusic.play().catch(err => console.log('Background music failed to resume:', err));
    }
    
    showEffect(isMuted ? '🔇 Sound Off' : '🔊 Sound On');
};

let score = 0;
let words = [];
let gameInterval;
let wordInputValue = "";
let wordCache = [];
let lastApiCall = 0;
let currentLevel = 'EASY';
let wordsTyped = 0;
let gameStartTime = Date.now();
let accuracy = { correct: 0, total: 0 };
let apiFailCount = 0;
const API_COOLDOWN = 1000; // Increased cooldown to avoid rate limits
const MAX_API_FAILS = 3; // Switch to fallback after this many consecutive failures

// Expanded fallback word list
const fallbackWords = [
    // Common 3-4 letter words
    "the", "and", "cat", "dog", "run", "jump", "play", "fast", "slow", "bird",
    "fish", "book", "read", "walk", "talk", "sing", "eat", "food", "drink",
    // 5-6 letter words
    "apple", "banana", "orange", "purple", "yellow", "green", "silver", "golden",
    "button", "window", "screen", "pencil", "paper", "folder", "music", "sound",
    "light", "heavy", "water", "coffee", "simple", "coding", "typing", "gaming",
    // 7-8 letter words
    "computer", "keyboard", "monitor", "speaker", "program", "internet", "website",
    "download", "software", "hardware", "network", "picture", "drawing", "painting",
    // 9+ letter words
    "technology", "development", "programming", "application", "javascript", "experience",
    "dictionary", "vocabulary", "knowledge", "education", "university", "challenge",
    // Tech terms
    "code", "bug", "debug", "array", "string", "number", "object", "function",
    "method", "class", "style", "event", "loop", "async", "await", "promise",
    "server", "client", "data", "cache", "error", "syntax", "logic", "algorithm",
    // Common verbs
    "write", "read", "speak", "listen", "watch", "create", "build", "design",
    "think", "learn", "teach", "study", "work", "play", "rest", "sleep", "wake",
    // Adjectives
    "quick", "slow", "smart", "clever", "bright", "dark", "loud", "quiet",
    "happy", "sad", "angry", "calm", "busy", "free", "new", "old", "young"
];

// Keep track of recently used words to avoid repetition
const recentlyUsedWords = new Set();
const MAX_RECENT_WORDS = 50;

// Power-up types
const POWER_UPS = {
    SLOW_TIME: { color: '#4CAF50', symbol: '⏰', duration: 5000, chance: 0.1 },
    DOUBLE_SCORE: { color: '#FFC107', symbol: '2️⃣', duration: 5000, chance: 0.05 },
    CLEAR_SCREEN: { color: '#FF5722', symbol: '💥', duration: 0, chance: 0.03 },
    SHIELD: { color: '#2196F3', symbol: '🛡️', duration: 7000, chance: 0.07 }
};

// Achievement system
const ACHIEVEMENTS = {
    SPEED_DEMON: { name: "Speed Demon", description: "Type 5 words in under 5 seconds", earned: false },
    COMBO_MASTER: { name: "Combo Master", description: "Get a 10x combo", earned: false },
    ACCURACY_KING: { name: "Accuracy King", description: "100% accuracy after 20 words", earned: false },
    SURVIVOR: { name: "Survivor", description: "Reach Hard difficulty", earned: false },
    POWERUP_COLLECTOR: { name: "Power Collector", description: "Collect all types of power-ups", earned: false }
};

// Theme system
const THEMES = {
    CYBER: {
        name: 'Cyber 🌐',
        background: '#0a192f',
        text: '#64ffda',
        wordColors: {
            easy: '#8892b0',
            medium: '#64ffda',
            difficult: '#ff5555'
        },
        accentColor: '#64ffda',
        fontFamily: "'JetBrains Mono', monospace"
    },
    RETRO: {
        name: 'Retro 👾',
        background: '#2b0f54',
        text: '#ff4e50',
        wordColors: {
            easy: '#8cc2dd',
            medium: '#ff4e50',
            difficult: '#ff9f1c'
        },
        accentColor: '#ff4e50',
        fontFamily: "'Courier New', monospace"
    },
    MATRIX: {
        name: 'Matrix 💻',
        background: '#000000',
        text: '#00ff00',
        wordColors: {
            easy: '#00cc00',
            medium: '#00ff00',
            difficult: '#39ff14'
        },
        accentColor: '#00ff00',
        fontFamily: "'Courier New', monospace"
    },
    MIDNIGHT: {
        name: 'Midnight 🌙',
        background: '#1a1b26',
        text: '#bb9af7',
        wordColors: {
            easy: '#7aa2f7',
            medium: '#bb9af7',
            difficult: '#f7768e'
        },
        accentColor: '#bb9af7',
        fontFamily: "'Fira Code', monospace"
    }
};

// Get saved theme or default to CYBER
let currentTheme = localStorage.getItem('gameTheme') || 'CYBER';

// Apply theme to the game
const applyTheme = (themeName) => {
    const theme = THEMES[themeName];
    if (!theme) return;

    // Apply styles directly
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;
    document.body.style.fontFamily = theme.fontFamily;

    // Style game container
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.style.border = `2px solid ${theme.accentColor}`;
    }

    // Style word input
    const wordInput = document.getElementById('word-input');
    if (wordInput) {
        wordInput.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        wordInput.style.color = theme.text;
        wordInput.style.borderColor = theme.accentColor;
        wordInput.style.fontFamily = theme.fontFamily;
    }

    // Style buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.style.borderColor = theme.accentColor;
        button.style.color = theme.text;
        button.style.fontFamily = theme.fontFamily;
    });

    // Style falling words
    const words = document.querySelectorAll('.falling-word');
    words.forEach(word => {
        if (word.classList.contains('difficult-word')) {
            word.style.color = theme.wordColors.difficult;
        } else if (word.classList.contains('medium-word')) {
            word.style.color = theme.wordColors.medium;
        } else {
            word.style.color = theme.wordColors.easy;
        }
    });

    // Style score display
    const scoreDisplay = document.getElementById('score');
    if (scoreDisplay) {
        scoreDisplay.style.color = theme.text;
    }

    // Style start screen if it exists
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.style.backgroundColor = theme.background;
        const startTitle = startScreen.querySelector('h1');
        const startText = startScreen.querySelector('p');
        if (startTitle) startTitle.style.color = theme.text;
        if (startText) startText.style.color = theme.text;
    }

    // Style game over screen
    const gameOverScreen = document.getElementById('game-over');
    if (gameOverScreen) {
        gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        gameOverScreen.style.borderColor = theme.accentColor;
        const gameOverElements = gameOverScreen.querySelectorAll('h2, p');
        gameOverElements.forEach(el => el.style.color = theme.text);
    }

    // Update theme state
    currentTheme = themeName;
    localStorage.setItem('gameTheme', themeName);

    // Update button text
    const themeButton = document.getElementById('theme-button');
    if (themeButton) {
        themeButton.textContent = theme.name;
        themeButton.style.borderColor = theme.accentColor;
    }

    // Update sound button
    const soundButton = document.getElementById('sound-toggle');
    if (soundButton) {
        soundButton.style.borderColor = theme.accentColor;
    }

    console.log('Theme applied:', themeName);
};

// Create theme selector
const createThemeSelector = () => {
    const themeButton = document.createElement('button');
    themeButton.id = 'theme-button';
    themeButton.textContent = THEMES[currentTheme].name;
    themeButton.style.position = 'fixed';
    themeButton.style.top = '20px';
    themeButton.style.left = '20px';
    themeButton.style.padding = '10px 20px';
    themeButton.style.fontSize = '16px';
    themeButton.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    themeButton.style.border = '2px solid ' + THEMES[currentTheme].accentColor;
    themeButton.style.borderRadius = '5px';
    themeButton.style.cursor = 'pointer';
    themeButton.style.zIndex = '1000';
    themeButton.style.transition = 'all 0.3s ease';

    document.body.insertBefore(themeButton, gameContainer);

    // Add event listener for theme changes
    themeButton.addEventListener('click', () => {
        const themeNames = Object.keys(THEMES);
        const currentIndex = themeNames.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themeNames.length;
        const nextTheme = themeNames[nextIndex];

        console.log('Changing theme from', currentTheme, 'to', nextTheme);
        applyTheme(nextTheme);
        showEffect(`Theme: ${THEMES[nextTheme].name}`);
    });

    // Add hover effect
    themeButton.addEventListener('mouseover', () => {
        themeButton.style.transform = 'scale(1.05)';
        themeButton.style.backgroundColor = THEMES[currentTheme].accentColor;
        themeButton.style.color = THEMES[currentTheme].background;
    });

    themeButton.addEventListener('mouseout', () => {
        themeButton.style.transform = 'scale(1)';
        themeButton.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        themeButton.style.color = THEMES[currentTheme].text;
    });
};

let collectedPowerups = new Set();

let activeEffects = {
    slowTime: false,
    doubleScore: false,
    shield: false
};

// Add after the game settings
let combo = 0;
let lastWordTime = 0;
const COMBO_TIMEOUT = 2000; // 2 seconds to maintain combo

// Fetch words from API
const fetchWordBatch = async () => {
    const now = Date.now();
    if (now - lastApiCall < API_COOLDOWN) {
        return false;
    }
    
    // If no API key is provided, use fallback words
    if (API_KEY === 'DEMO_KEY') {
        return false;
    }
    
    try {
        lastApiCall = now;
        const response = await fetch(`${API_URL}?api_key=${API_KEY}&minLength=3&maxLength=10`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        wordCache.push(data.word.toLowerCase());
        apiFailCount = 0;
        return true;
    } catch (error) {
        console.error('Error fetching words:', error);
        apiFailCount++;
        return false;
    }
};

// Get a unique word from the fallback list
const getUniqueWord = () => {
    let attempts = 0;
    let word;
    
    do {
        word = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
        attempts++;
    } while (recentlyUsedWords.has(word) && attempts < 10);

    recentlyUsedWords.add(word);
    
    if (recentlyUsedWords.size > MAX_RECENT_WORDS) {
        const iterator = recentlyUsedWords.values();
        recentlyUsedWords.delete(iterator.next().value);
    }

    return word;
};

// Get a random word
const getRandomWord = async () => {
    if (apiFailCount >= MAX_API_FAILS) {
        return getUniqueWord();
    }

    if (wordCache.length < 5) {
        await fetchWordBatch();
    }

    if (wordCache.length > 0) {
        const word = wordCache.pop();
        recentlyUsedWords.add(word);
        return word;
    }

    return getUniqueWord();
};

// Game stats
const updateStats = (isCorrect) => {
    accuracy.total++;
    if (isCorrect) {
        accuracy.correct++;
    }
};

// Calculate WPM (Words Per Minute)
const calculateWPM = () => {
    const minutesElapsed = (Date.now() - gameStartTime) / 60000;
    return Math.round(wordsTyped / minutesElapsed);
};

// Update difficulty based on score
const updateDifficulty = () => {
    if (score >= 50) {  // Increased threshold from 30 to 50
        currentLevel = 'HARD';
        if (!ACHIEVEMENTS.SURVIVOR.earned) {
            ACHIEVEMENTS.SURVIVOR.earned = true;
            showAchievement(ACHIEVEMENTS.SURVIVOR);
        }
    } else if (score >= 25) {  // Increased threshold from 15 to 25
        currentLevel = 'MEDIUM';
    }
    return DIFFICULTY_SETTINGS[currentLevel];
};

// Generate a non-overlapping horizontal position
const generatePosition = () => {
    return Math.random() * 90; // Random position between 0-90%
};

// Modified createWord function to add word length-based scoring
const createWord = async () => {
    const word = await getRandomWord();
    const wordElement = document.createElement("div");
    wordElement.classList.add("falling-word");
    wordElement.textContent = word;
    
    // Add color coding based on word length
    if (word.length > 8) {
        wordElement.classList.add('difficult-word');
    } else if (word.length > 5) {
        wordElement.classList.add('medium-word');
    }

    const posX = generatePosition();
    wordElement.style.left = `${posX}%`;
    wordElement.style.top = `0px`;
    gameContainer.appendChild(wordElement);
    words.push(wordElement);
};

// Create power-up element
const createPowerUp = () => {
    if (Math.random() > 0.15) return; // 15% chance to spawn power-up

    const powerUpTypes = Object.entries(POWER_UPS);
    const [type, config] = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    if (Math.random() > config.chance) return;

    const powerUpElement = document.createElement("div");
    powerUpElement.classList.add('power-up');
    powerUpElement.innerHTML = config.symbol;
    powerUpElement.style.color = config.color;
    powerUpElement.dataset.type = type;

    const posX = generatePosition();
    powerUpElement.style.left = `${posX}%`;
    powerUpElement.style.top = '0px';
    gameContainer.appendChild(powerUpElement);

    // Make power-ups fall
    const fallInterval = setInterval(() => {
        const currentTop = parseFloat(powerUpElement.style.top);
        if (currentTop < gameContainer.offsetHeight - 30) {
            powerUpElement.style.top = `${currentTop + 2}px`;
        } else {
            clearInterval(fallInterval);
            gameContainer.removeChild(powerUpElement);
        }
    }, 50);

    // Collect power-up on hover
    powerUpElement.addEventListener('mouseover', () => {
        activatePowerUp(type);
        gameContainer.removeChild(powerUpElement);
        clearInterval(fallInterval);
    });
};

// Activate power-up effects
const activatePowerUp = (type) => {
    const config = POWER_UPS[type];
    playSound('powerup');
    
    // Check for power-up collector achievement
    collectedPowerups.add(type);
    if (collectedPowerups.size === Object.keys(POWER_UPS).length && !ACHIEVEMENTS.POWERUP_COLLECTOR.earned) {
        ACHIEVEMENTS.POWERUP_COLLECTOR.earned = true;
        showAchievement(ACHIEVEMENTS.POWERUP_COLLECTOR);
    }
    
    switch(type) {
        case 'SLOW_TIME':
            activeEffects.slowTime = true;
            showEffect('⏰ Slow Motion!');
            setTimeout(() => {
                activeEffects.slowTime = false;
                showEffect('Speed Normal');
            }, config.duration);
            break;
            
        case 'DOUBLE_SCORE':
            activeEffects.doubleScore = true;
            showEffect('2️⃣ Double Score!');
            setTimeout(() => {
                activeEffects.doubleScore = false;
                showEffect('Score Normal');
            }, config.duration);
            break;
            
        case 'CLEAR_SCREEN':
            showEffect('💥 Screen Cleared!');
            words.forEach(word => gameContainer.removeChild(word));
            words = [];
            break;
            
        case 'SHIELD':
            activeEffects.shield = true;
            showEffect('🛡️ Shield Active!');
            setTimeout(() => {
                activeEffects.shield = false;
                showEffect('Shield Down');
            }, config.duration);
            break;
    }
};

// Show effect notification
const showEffect = (message) => {
    const effect = document.createElement('div');
    effect.classList.add('effect-notification');
    effect.textContent = message;
    gameContainer.appendChild(effect);
    
    setTimeout(() => {
        effect.classList.add('fade-out');
        setTimeout(() => gameContainer.removeChild(effect), 500);
    }, 1500);
};

// Modify the moveWords function to account for power-ups
const moveWords = () => {
    const { speed } = updateDifficulty();
    const actualSpeed = activeEffects.slowTime ? speed * 0.5 : speed;
    
    words.forEach(word => {
        const currentTop = parseFloat(word.style.top);
        if (currentTop < gameContainer.offsetHeight - 50) {
            word.style.top = `${currentTop + actualSpeed}px`;
        } else {
            if (!activeEffects.shield) {
            gameContainer.removeChild(word);
                words = words.filter(w => w !== word);
                updateStats(false);
            if (words.length === 0) {
                    endGame();
                }
            } else {
                // Bounce word back up when shield is active
                word.style.top = '0px';
            }
        }
    });
};

// Add after the theme system
const PARTICLE_COLORS = {
    CYBER: ['#64ffda', '#8892b0', '#ff5555'],
    RETRO: ['#ff4e50', '#8cc2dd', '#ff9f1c'],
    MATRIX: ['#00ff00', '#00cc00', '#39ff14'],
    MIDNIGHT: ['#bb9af7', '#7aa2f7', '#f7768e']
};

// Enhanced Particle System with different types
class Particle {
    constructor(x, y, color, type = 'default') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.size = Math.random() * 3 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.life = 1;
        this.decay = type === 'letter' ? 0.02 : 0.015;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 10;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
        
        // Add gravity effect for letter particles
        if (this.type === 'letter') {
            this.speedY += 0.1;
        }
        
        // Add spiral effect for special particles
        if (this.type === 'spiral') {
            const angle = this.rotation * (Math.PI / 180);
            this.x += Math.cos(angle) * 2;
            this.y += Math.sin(angle) * 2;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = this.life;
        
        if (this.type === 'letter') {
            ctx.font = `${this.size * 3}px ${THEMES[currentTheme].fontFamily}`;
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, 0, 0);
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            if (this.type === 'star') {
                this.drawStar(ctx);
            } else {
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            }
            ctx.fill();
        }
        
        ctx.restore();
    }

    drawStar(ctx) {
        const spikes = 5;
        const outerRadius = this.size;
        const innerRadius = this.size / 2;

        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    }
}

// Create letter particles for word shattering effect
const createLetterParticles = (word, x, y) => {
    const letters = word.split('');
    const colors = PARTICLE_COLORS[currentTheme];
    
    letters.forEach((letter, index) => {
        const particle = new Particle(
            x + (index * 15),
            y,
            colors[Math.floor(Math.random() * colors.length)],
            'letter'
        );
        particle.text = letter;
        particles.push(particle);
    });
};

// Create special effect particles
const createSpecialParticles = (x, y, type = 'star') => {
    const colors = PARTICLE_COLORS[currentTheme];
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)], type));
    }
};

// Dynamic background effect
class BackgroundEffect {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'background-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '-1';
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.numPoints = 70;  // Increased number of points
        this.intensity = 1;   // Base intensity is now 1 instead of 0
        this.maxIntensity = 8;
        this.baseSpeed = 0.5; // Base movement speed
        this.connectionDistance = 200; // Increased connection distance
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createPoints();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createPoints() {
        this.points = [];
        for (let i = 0; i < this.numPoints; i++) {
            this.points.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                speedX: (Math.random() - 0.5) * 2,
                speedY: (Math.random() - 0.5) * 2,
                size: Math.random() * 2 + 1  // Random point sizes
            });
        }
    }

    updateIntensity(combo) {
        // Smooth transition to new intensity
        const targetIntensity = Math.min(this.maxIntensity, 1 + (combo / 3));
        this.intensity += (targetIntensity - this.intensity) * 0.1;
    }

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update points position with base movement
        this.points.forEach(point => {
            point.x += point.speedX * (this.baseSpeed + this.intensity * 0.5);
            point.y += point.speedY * (this.baseSpeed + this.intensity * 0.5);
            
            // Wrap around screen with smooth transition
            if (point.x < 0) point.x = this.canvas.width;
            if (point.x > this.canvas.width) point.x = 0;
            if (point.y < 0) point.y = this.canvas.height;
            if (point.y > this.canvas.height) point.y = 0;
        });
        
        // Draw connections with enhanced visuals
        this.ctx.strokeStyle = THEMES[currentTheme].accentColor;
        this.ctx.fillStyle = THEMES[currentTheme].accentColor;
        
        // Draw points
        this.points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw connections with gradient opacity
        for (let i = 0; i < this.points.length; i++) {
            for (let j = i + 1; j < this.points.length; j++) {
                const dx = this.points[i].x - this.points[j].x;
                const dy = this.points[i].y - this.points[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.connectionDistance) {
                    this.ctx.beginPath();
                    this.ctx.lineWidth = 0.5;
                    
                    // Create gradient for line
                    const gradient = this.ctx.createLinearGradient(
                        this.points[i].x, this.points[i].y,
                        this.points[j].x, this.points[j].y
                    );
                    
                    const alpha = (1 - (distance / this.connectionDistance)) * 0.5;
                    gradient.addColorStop(0, `${THEMES[currentTheme].accentColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
                    gradient.addColorStop(1, `${THEMES[currentTheme].accentColor}00`);
                    
                    this.ctx.strokeStyle = gradient;
                    this.ctx.moveTo(this.points[i].x, this.points[i].y);
                    this.ctx.lineTo(this.points[j].x, this.points[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(() => this.update());
    }
}

// Initialize background effect
const backgroundEffect = new BackgroundEffect();
backgroundEffect.update();

// Initialize particle system
let particles = [];
const particleCanvas = document.createElement('canvas');
particleCanvas.id = 'particle-canvas';
particleCanvas.style.position = 'fixed';
particleCanvas.style.top = '0';
particleCanvas.style.left = '0';
particleCanvas.style.width = '100%';
particleCanvas.style.height = '100%';
particleCanvas.style.pointerEvents = 'none';
particleCanvas.style.zIndex = '1';
document.body.appendChild(particleCanvas);

// Set actual canvas size
const updateCanvasSize = () => {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
};

updateCanvasSize();
window.addEventListener('resize', updateCanvasSize);

const ctx = particleCanvas.getContext('2d');

// Update and draw particles
const updateParticles = () => {
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    requestAnimationFrame(updateParticles);
};

// Start particle animation
updateParticles();

// Modify checkInput to fix word typing
const checkInput = () => {
    if (!wordInputValue) return;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.textContent.toLowerCase() === wordInputValue.toLowerCase()) {
            const rect = word.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Create letter particles
            createLetterParticles(word.textContent, rect.left, rect.top);
            
            // Create special particles based on combo
            if (combo >= 5) {
                createSpecialParticles(centerX, centerY, 'star');
            }
            if (combo >= 10) {
                createSpecialParticles(centerX, centerY, 'spiral');
            }
            
            // Update background effect intensity
            backgroundEffect.updateIntensity(combo);
            
            // Add screen shake for high combos
            if (combo >= 8) {
                const intensity = Math.min(20, combo * 2);
                shakeScreen(intensity);
            }
            
            gameContainer.removeChild(word);
            words = words.filter(w => w !== word);
            
            const { scoreMultiplier } = DIFFICULTY_SETTINGS[currentLevel];
            let wordScore = word.textContent.length * scoreMultiplier;
            
            const now = Date.now();
            if (now - lastWordTime < COMBO_TIMEOUT) {
                combo++;
                if (combo >= 10 && !ACHIEVEMENTS.COMBO_MASTER.earned) {
                    ACHIEVEMENTS.COMBO_MASTER.earned = true;
                    showAchievement(ACHIEVEMENTS.COMBO_MASTER);
                }
                wordScore *= (1 + (combo * 0.1));
                showEffect(`Combo x${combo}!`);
                playSound('success');
            } else {
                combo = 0;
            }
            lastWordTime = now;
            
            if (wordsTyped >= 4 && (now - gameStartTime) < 5000 && !ACHIEVEMENTS.SPEED_DEMON.earned) {
                ACHIEVEMENTS.SPEED_DEMON.earned = true;
                showAchievement(ACHIEVEMENTS.SPEED_DEMON);
            }
            
            if (activeEffects.doubleScore) {
                wordScore *= 2;
            }
            
            showEffect(`+${Math.round(wordScore)} points!`);
            playSound('success');
            
            score += Math.round(wordScore);
            wordsTyped++;
            updateStats(true);
            
            if (accuracy.total >= 20 && accuracy.correct === accuracy.total && !ACHIEVEMENTS.ACCURACY_KING.earned) {
                ACHIEVEMENTS.ACCURACY_KING.earned = true;
                showAchievement(ACHIEVEMENTS.ACCURACY_KING);
            }
            
            scoreDisplay.textContent = `Score: ${score} | WPM: ${calculateWPM()} | Combo: x${combo} | Accuracy: ${Math.round((accuracy.correct/accuracy.total)*100)}%`;
            wordInput.value = "";
            wordInputValue = "";
            break;
        }
    }
};

// Update input event listener
wordInput.addEventListener("input", (event) => {
    wordInputValue = event.target.value.trim().toLowerCase();
    playSound('type');
    checkInput();
});

// New endGame function with detailed stats
const endGame = () => {
    clearInterval(gameInterval);
    AUDIO.bgMusic.pause();
    playSound('gameOver');
    
    const wpm = calculateWPM();
    const accuracyPercent = Math.round((accuracy.correct/accuracy.total)*100);
    
    gameOverScreen.style.display = "block";
    gameOverScreen.innerHTML = `
        <h2>Game Over!</h2>
        <p>Final Score: ${score}</p>
        <p>Words Per Minute: ${wpm}</p>
        <p>Accuracy: ${accuracyPercent}%</p>
        <p>Highest Level: ${currentLevel}</p>
        <button onclick="location.reload()">Play Again</button>
    `;
};

// Modify the game loop to include word spawn delay
const startGame = () => {
    gameStartTime = Date.now();
    scoreDisplay.textContent = "Score: 0 | WPM: 0 | Accuracy: 0%";
    
    // Start background music
    AUDIO.bgMusic.play().catch(err => console.log('Background music failed to start:', err));
    
    let wordCount = 0;
    const maxWordsOnScreen = 10;  // Maximum words allowed on screen
    
    const gameLoop = async () => {
        // Only spawn new word if we're under the limit
        if (words.length < maxWordsOnScreen) {
            await createWord();
            wordCount++;
        }
        
        createPowerUp();
        moveWords();
        checkInput();
        
        // Adjust interval based on current difficulty
        const { interval } = updateDifficulty();
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, interval);
    };
    
    gameInterval = setInterval(gameLoop, DIFFICULTY_SETTINGS.EASY.interval);
};

// Handle input event for typing words
wordInput.addEventListener("input", (event) => {
    wordInputValue = event.target.value;
    playSound('type');
    checkInput();
});

// Add after the audio system setup
const createStartScreen = () => {
    // Create theme selector first
    createThemeSelector();
    
    // Apply saved theme or default
    setTimeout(() => applyTheme(currentTheme), 0);
    
    const startScreen = document.createElement('div');
    startScreen.id = 'start-screen';
    startScreen.style.display = 'flex';
    startScreen.style.flexDirection = 'column';
    startScreen.style.alignItems = 'center';
    startScreen.style.justifyContent = 'center';
    startScreen.style.gap = '20px';  // Add space between elements
    startScreen.style.padding = '40px';  // Add padding around all elements
    startScreen.style.marginBottom = '30px';  // Add margin at the bottom

    const title = document.createElement('h1');
    title.textContent = 'Word Typing Game';
    title.style.fontSize = '2.5em';
    title.style.marginBottom = '10px';

    const description = document.createElement('p');
    description.textContent = 'Type the falling words before they reach the bottom!';
    description.style.fontSize = '1.2em';
    description.style.marginBottom = '30px';

    const startButton = document.createElement('button');
    startButton.id = 'start-button';
    startButton.textContent = 'Click to Start';
    startButton.style.fontSize = '1.3em';
    startButton.style.padding = '15px 40px';
    startButton.style.cursor = 'pointer';
    startButton.style.transition = 'all 0.3s ease';
    startButton.style.marginTop = '20px';

    // Add hover effect to start button
    startButton.addEventListener('mouseover', () => {
        startButton.style.transform = 'scale(1.1)';
        startButton.style.backgroundColor = THEMES[currentTheme].accentColor;
        startButton.style.color = THEMES[currentTheme].background;
    });

    startButton.addEventListener('mouseout', () => {
        startButton.style.transform = 'scale(1)';
        startButton.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        startButton.style.color = THEMES[currentTheme].text;
    });

    startScreen.appendChild(title);
    startScreen.appendChild(description);
    startScreen.appendChild(startButton);
    document.body.appendChild(startScreen);

    // Initialize audio only after user interaction
    startButton.addEventListener('click', () => {
        // Initialize all audio elements
        initAudio();

        // Start the game
        AUDIO.bgMusic.play()
            .then(() => {
                startScreen.remove();
                startGame();
            })
            .catch(err => {
                console.error('Audio failed to start:', err);
                startScreen.remove();
                startGame();
            });
    });
};

// Modify the end of the file to show start screen instead of auto-starting
// Remove or comment out the direct startGame() call
// startGame();
createStartScreen();

const showAchievement = (achievement) => {
    playSound('achievement');
    const achievementElement = document.createElement('div');
    achievementElement.classList.add('achievement');
    achievementElement.innerHTML = `
        <h3>🏆 Achievement Unlocked!</h3>
        <p>${achievement.name}</p>
        <p>${achievement.description}</p>
    `;
    gameContainer.appendChild(achievementElement);
    
    setTimeout(() => {
        achievementElement.classList.add('fade-out');
        setTimeout(() => gameContainer.removeChild(achievementElement), 500);
    }, 3000);
};

// Add after game container initialization
const soundButton = document.createElement('button');
soundButton.id = 'sound-toggle';
soundButton.innerHTML = '🔊';
soundButton.onclick = () => {
    toggleAudio();
    soundButton.innerHTML = isMuted ? '🔇' : '🔊';
};
document.body.insertBefore(soundButton, gameContainer);

// Add this at the very end of the file, after all other code
document.addEventListener('DOMContentLoaded', () => {
    // Apply initial theme
    applyTheme(currentTheme);
});

// Screen shake effect
const shakeScreen = (intensity) => {
    const gameContainer = document.getElementById('game-container');
    let shakeCount = 0;
    const maxShakes = 5;
    const shakeInterval = setInterval(() => {
        const xShake = (Math.random() - 0.5) * intensity;
        const yShake = (Math.random() - 0.5) * intensity;
        gameContainer.style.transform = `translate(${xShake}px, ${yShake}px)`;
        
        shakeCount++;
        if (shakeCount >= maxShakes) {
            clearInterval(shakeInterval);
            gameContainer.style.transform = 'translate(0, 0)';
        }
    }, 50);
};
