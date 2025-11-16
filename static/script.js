const subs = JSON.parse(document.getElementById("subs-data").textContent || "[]");
const audio = document.getElementById("player");
const lyricsDiv = document.getElementById("lyrics");
const typingInput = document.getElementById("typing-input");
const highlightedLyric = document.getElementById("highlighted-lyric");
let lastLineIndex = -1;
let canType = false;
let currentLyric = "";

// Performance tracking variables
let totalCharacters = 0;
let correctCharacters = 0;
let missedCharacters = 0;
let currentLineCorrectChars = 0;
let performanceStats = [];

// Calculate total characters on load
function calculateTotalCharacters() {
    totalCharacters = subs.reduce((total, sub) => {
        return total + sub.text.replace(/[^\w\s]/g, '').length;
    }, 0);
}

// Initialize performance tracking
if (subs.length > 0) {
    calculateTotalCharacters();
}

// Initialize lyrics display
lyricsDiv.innerHTML = "";

function renderLyrics(lineIndex) {
    let html = "";
    if (lineIndex > 0) {
        html += `<div style="color: #ffeb3b; opacity: 0.5; font-weight:normal; font-size:20px; margin: 6px 0;">${subs[lineIndex - 1].text}</div>`;
    }
    html += `<div style="color: #ffeb3b; font-weight:bold; font-size:24px; margin: 8px 0;">${subs[lineIndex].text}</div>`;
    if (lineIndex < subs.length - 1) {
        html += `<div style="color: #ffeb3b; opacity: 0.5; font-weight:normal; font-size:20px; margin: 6px 0;">${subs[lineIndex + 1].text}</div>`;
    }
    lyricsDiv.innerHTML = html;
}

function renderTypingBox(lineIndex) {
    currentLyric = subs[lineIndex].text;
    typingInput.value = "";
    highlightedLyric.innerHTML = highlightTyped("", currentLyric);
    typingInput.disabled = false;
    typingInput.focus();
}

function highlightTyped(typed, lyric) {
    let html = "";
    let lyricArr = lyric.split("");
    let typedArr = typed.split("");
    let lyricPos = 0;
    let correctCount = 0;
    
    for (let t = 0; t < typedArr.length && lyricPos < lyricArr.length; t++) {
        // Find the next matching character in lyric
        let found = false;
        for (let l = lyricPos; l < lyricArr.length; l++) {
            if (typedArr[t].toLowerCase() === lyricArr[l].toLowerCase()) {
                // All untyped before l are faint
                for (let k = lyricPos; k < l; k++) {
                    html += `<span style="color:#b0c4de; opacity:0.4">${lyricArr[k]}</span>`;
                }
                html += `<span style="color:#fff">${lyricArr[l]}</span>`;
                lyricPos = l + 1;
                found = true;
                // Count correct characters (excluding spaces and punctuation)
                if (/\w/.test(lyricArr[l])) {
                    correctCount++;
                }
                break;
            }
        }
        if (!found) {
            // Typed letter does not exist in remaining lyric, ignore it
        }
    }
    // Remaining lyric is faint
    for (let k = lyricPos; k < lyricArr.length; k++) {
        html += `<span style="color:#b0c4de; opacity:0.4">${lyricArr[k]}</span>`;
    }
    
    // Update current line correct characters count
    currentLineCorrectChars = correctCount;
    
    return html;
}

// Only allow typing when a lyric is active
audio.addEventListener("timeupdate", () => {
    const current = audio.currentTime;
    let lineIndex = -1;
    for (let i = 0; i < subs.length; i++) {
        if (current >= (subs[i].start - 0.5) && current <= (subs[i].end + 0.5)) {
            lineIndex = i;
            break;
        }
    }

    if (lineIndex !== -1 && lineIndex !== lastLineIndex) {
        // Save stats for previous line if it existed
        if (lastLineIndex !== -1) {
            saveLineStats(lastLineIndex);
        }
        
        renderLyrics(lineIndex);
        renderTypingBox(lineIndex);
        canType = true;
        lastLineIndex = lineIndex;
        currentLineCorrectChars = 0; // Reset for new line
    } else if (lineIndex === -1 && lastLineIndex !== -1) {
        // Save stats for the line that just ended
        saveLineStats(lastLineIndex);
        
        lyricsDiv.innerHTML = "";
        highlightedLyric.innerHTML = "";
        typingInput.value = "";
        typingInput.disabled = true;
        canType = false;
        lastLineIndex = -1;
    }
});

function saveLineStats(lineIndex) {
    if (lineIndex >= 0 && lineIndex < subs.length) {
        const lineText = subs[lineIndex].text.replace(/[^\w\s]/g, '');
        const lineCharCount = lineText.length;
        const missed = Math.max(0, lineCharCount - currentLineCorrectChars);
        
        correctCharacters += currentLineCorrectChars;
        missedCharacters += missed;
        
        performanceStats[lineIndex] = {
            total: lineCharCount,
            correct: currentLineCorrectChars,
            missed: missed
        };
    }
}

typingInput.addEventListener("input", () => {
    if (!canType) return;
    highlightedLyric.innerHTML = highlightTyped(typingInput.value, currentLyric);
});

typingInput.addEventListener("paste", e => e.preventDefault());
typingInput.addEventListener("beforeinput", e => {
    if (typingInput.value.length >= currentLyric.length && e.inputType === "insertText") {
        e.preventDefault();
    }
});

audio.addEventListener("loadedmetadata", () => {
    console.log("Audio loaded, duration:", audio.duration);
});

setInterval(() => {
    if (!audio.paused) {
        console.log(`Current time: ${audio.currentTime.toFixed(1)}s`);
    }
}, 5000);

document.getElementById("typing-box").addEventListener("click", () => {
    if (canType) typingInput.focus();
});

// Music bar
const barContainer = document.getElementById("custom-audio-bar-container");
const barBg = document.getElementById("custom-audio-bar-bg");
const barProgress = document.getElementById("custom-audio-bar-progress");
const barThumb = document.getElementById("custom-audio-bar-thumb");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateBar() {
    if (!audio.duration) return;

    const percent = audio.currentTime / audio.duration;
    barProgress.style.width = (percent * 100) + "%";
    barThumb.style.left = `calc(${percent * 100}% - 8px)`;

    // Update current time
    if (timeCurrent) {
        timeCurrent.textContent = formatTime(audio.currentTime);
    }
}

function setTotalTime() {
    // Set total time when metadata loads
    if (timeTotal && audio.duration && audio.duration > 0) {
        timeTotal.textContent = formatTime(audio.duration);
        console.log("Total time set to:", formatTime(audio.duration));
    }
}

// Initialize time displays
if (timeCurrent) timeCurrent.textContent = "0:00";
if (timeTotal) timeTotal.textContent = "0:00";

audio.addEventListener("timeupdate", updateBar);
audio.addEventListener("loadedmetadata", () => {
    console.log("Audio loaded, duration:", audio.duration);
    setTotalTime();
    updateBar(); // Initial bar update
});

// Also try to set total time when audio can play
audio.addEventListener("canplay", () => {
    if (audio.duration && audio.duration > 0 && timeTotal) {
        setTotalTime();
    }
});

// Additional event listeners to catch duration when it becomes available
audio.addEventListener("durationchange", () => {
    if (audio.duration && audio.duration > 0) {
        setTotalTime();
    }
});

audio.addEventListener("loadeddata", () => {
    if (audio.duration && audio.duration > 0) {
        setTotalTime();
    }
});

barBg.addEventListener("click", function (e) {
    const rect = barBg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audio.currentTime = percent * audio.duration;
    updateBar();
});

// Music Control Button
const pauseResumeBtn = document.getElementById("pause-resume-btn");

// Function to update pause/resume button state
function updatePauseResumeButton() {
    if (audio.paused) {
        pauseResumeBtn.textContent = "▶";
    } else {
        pauseResumeBtn.textContent = "⏸";
    }
}

// Initialize button state to paused
updatePauseResumeButton();



pauseResumeBtn.onclick = () => {
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
    updatePauseResumeButton();
};

// Update button state when audio playback state changes
audio.addEventListener("play", updatePauseResumeButton);
audio.addEventListener("pause", updatePauseResumeButton);
audio.addEventListener("ended", () => {
    audio.pause();
    updatePauseResumeButton();
    
    // Save stats for the last line if it was active
    if (lastLineIndex !== -1) {
        saveLineStats(lastLineIndex);
    }
    
    // Show performance dialog
    showPerformanceDialog();
});

function showPerformanceDialog() {
    const accuracy = totalCharacters > 0 ? ((correctCharacters / totalCharacters) * 100).toFixed(1) : '0.0';
    
    // Update dialog content
    document.getElementById('total-chars').textContent = totalCharacters;
    document.getElementById('correct-chars').textContent = correctCharacters;
    document.getElementById('missed-chars').textContent = missedCharacters;
    document.getElementById('accuracy-percent').textContent = accuracy + '%';
    
    // Show dialog
    document.getElementById('performance-dialog').style.display = 'flex';
}

function resetPerformanceStats() {
    correctCharacters = 0;
    missedCharacters = 0;
    currentLineCorrectChars = 0;
    performanceStats = [];
    lastLineIndex = -1;
}

// Dialog button event listeners
document.addEventListener('DOMContentLoaded', function() {
    const startOverBtn = document.getElementById('start-over-btn');
    const tryNextBtn = document.getElementById('try-next-btn');
    const performanceDialog = document.getElementById('performance-dialog');
    
    if (startOverBtn) {
        startOverBtn.addEventListener('click', function() {
            // Hide dialog
            performanceDialog.style.display = 'none';
            
            // Reset stats
            resetPerformanceStats();
            
            // Reset audio and UI
            audio.currentTime = 0;
            audio.pause();
            updatePauseResumeButton();
            lyricsDiv.innerHTML = "";
            highlightedLyric.innerHTML = "";
            typingInput.value = "";
            typingInput.disabled = true;
            canType = false;
        });
    }
    
    if (tryNextBtn) {
        tryNextBtn.addEventListener('click', function() {
            // Navigate back to home page
            window.location.href = '/';
        });
    }
});

document.addEventListener("keydown", function (e) {
    // Prevent space bar from triggering when typing in the input
    if ((e.key === " " || e.key === "Enter") && e.target !== typingInput && audio.src) {
        e.preventDefault();
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
        updatePauseResumeButton();
    }
});