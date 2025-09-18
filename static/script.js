const subs = JSON.parse(document.getElementById("subs-data").textContent || "[]");
const audio = document.getElementById("player");
const lyricsDiv = document.getElementById("lyrics");
const typingInput = document.getElementById("typing-input");
const highlightedLyric = document.getElementById("highlighted-lyric");
let lastLineIndex = -1;
let canType = false;
let currentLyric = "";

function renderLyrics(lineIndex) {
    let html = "";
    if (lineIndex > 0) {
        html += `<div style="color: #b0b0b0; font-weight:normal; font-size:16px;">${subs[lineIndex-1].text}</div>`;
    }
    html += `<div style="color: #1a237e; font-weight:bold; font-size:20px;">${subs[lineIndex].text}</div>`;
    if (lineIndex < subs.length - 1) {
        html += `<div style="color: #b0b0b0; font-weight:normal; font-size:16px;">${subs[lineIndex+1].text}</div>`;
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
        renderLyrics(lineIndex);
        renderTypingBox(lineIndex);
        canType = true;
        lastLineIndex = lineIndex;
    } else if (lineIndex === -1 && lastLineIndex !== -1) {
        lyricsDiv.innerHTML = "";
        highlightedLyric.innerHTML = "";
        typingInput.value = "";
        typingInput.disabled = true;
        canType = false;
        lastLineIndex = -1;
    }
});

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