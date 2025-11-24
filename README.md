# Lyrics Player

A web-based karaoke-style typing game that lets you practice typing along with your favorite YouTube videos. Download audio and synchronized lyrics, then test your typing skills while the music plays!

## Features

- **YouTube Integration** - Paste any YouTube URL to extract audio and subtitles
- **Real-time Typing** - Type along with synchronized lyrics as the song plays
- **Performance Tracking** - Get detailed accuracy statistics and typing metrics
- **Multi-language Support** - Choose from available subtitle languages
- **Custom Audio Controls** - Built-in audio player with progress bar and playback controls
- Works on desktop

## Prerequisites

- Python 3.7+
- **FFmpeg** installed and available in system PATH
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg` or equivalent

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lyrics-player
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Verify FFmpeg installation:
```bash
ffmpeg -version
```

## Usage

1. Start the server:
```bash
uvicorn app:app --reload
```

2. Open your browser and navigate to `http://localhost:8000`

3. Paste a YouTube URL and follow the prompts to:
   - Check for available subtitles
   - Select your preferred language
   - Download and start playing!

## How It Works

1. **URL Processing** - Uses yt-dlp to extract video metadata and available subtitles
2. **Audio Download** - Downloads the best quality audio from YouTube
3. **Subtitle Parsing** - Processes SRT/VTT subtitle files with precise timing
4. **Synchronized Playback** - Displays lyrics in real-time as you type along
5. **Performance Analysis** - Tracks typing accuracy and provides detailed feedback

## Future Roadmap

- [ ] **Audio Waveform Visualization** - Integrate FFmpeg waveform generation for visual audio representation
- [ ] Difficulty levels and typing challenges
- [ ] User accounts and progress tracking
- [ ] Playlist support for multiple songs
- [ ] Custom subtitle upload

## Contributing

Feel free to submit issues and pull requests to help improve the Lyrics Player!

## License

This project is open source and available under the MIT License.