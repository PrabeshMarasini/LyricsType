import os
import yt_dlp
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/downloads", StaticFiles(directory="downloads"), name="downloads")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# convert "00:01:20,500" or "00:01:20.500" → seconds
def to_seconds(timestr: str) -> float:
    h, m, s = timestr.split(":")
    if "," in s:                     # Handle both comma and dot as decimal separator
        sec, ms = s.split(",")
    else:
        sec, ms = s.split(".")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000.0


# parse both .srt and .vtt files into structured list
def parse_subtitles(path: str):
    subs = []
    print(f"Attempting to parse subtitle file: {path}")
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.splitlines()
        print(f"File read successfully, {len(lines)} lines")
        print(f"First few lines: {lines[:5]}")
    except Exception as e:
        print(f"Error reading file: {e}")
        return subs

    is_vtt = path.endswith('.vtt') or (lines and lines[0].strip() == 'WEBVTT')
    print(f"File type detected: {'VTT' if is_vtt else 'SRT'}")

    i = 0
    
    # Skip VTT header if present
    if is_vtt:
        while i < len(lines) and not " --> " in lines[i]:
            i += 1

    while i < len(lines):
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            break
            
        if " --> " in lines[i]:
            try:
                start_str, end_str = lines[i].split(" --> ", 1)
                end_str = end_str.split()[0]
                start, end = to_seconds(start_str.strip()), to_seconds(end_str.strip())
                i += 1
                text_lines = []
                while i < len(lines) and lines[i].strip() != "":
                    text_lines.append(lines[i])
                    i += 1
                if text_lines:
                    subtitle_entry = {
                        "start": float(start),
                        "end": float(end),
                        "text": " ".join(text_lines)
                    }
                    subs.append(subtitle_entry)
                    if len(subs) <= 3:
                        print(f"Parsed entry {len(subs)}: {subtitle_entry}")
            except Exception as e:
                print(f"Error parsing entry at line {i}: {e}")
                i += 1
                continue
        elif not is_vtt and lines[i].strip().isdigit():
            i += 1
            if i >= len(lines): 
                break
        else:
            i += 1
    
    print(f"Successfully parsed {len(subs)} subtitle entries")
    return subs


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "song": None, "subs": [], "subtitles": None, "url": None}
    )


# Check available subtitles
@app.post("/get_subtitles", response_class=HTMLResponse)
async def get_subtitles(request: Request, url: str = Form(...)):
    ydl_opts = {"quiet": True, "skip_download": True}
    subs_list = []

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get("title")
            thumbnail = info.get("thumbnail")
            subs_dict = info.get("subtitles") or info.get("automatic_captions") or {}
            subs_list = list(subs_dict.keys())

        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "subtitles": subs_list,
                "url": url,
                "song": None,
                "subs": []
            }
        )
    except Exception as e:
        print(f"Error processing URL: {e}")
        # Return error state - using "invalid" as a special marker
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "subtitles": "invalid",
                "url": url,
                "song": None,
                "subs": []
            }
        )


# Step 2: Download audio & subtitles
@app.post("/download", response_class=HTMLResponse)
async def download(request: Request, url: str = Form(...), lang: str = Form("en")):
    os.makedirs("downloads", exist_ok=True)

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": "downloads/%(title)s.%(ext)s",
        "subtitleslangs": [lang],
        "writesubtitles": True,
        "skip_download": False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        song_file = ydl.prepare_filename(info)
        title = info.get("title")
        thumbnail = info.get("thumbnail")

    base, _ = os.path.splitext(song_file)

    print(f"Base filename: {base}")
    print(f"Looking for subtitles with language: {lang}")
    
    all_files = os.listdir("downloads")
    print(f"All files in downloads: {all_files}")

    subs = []
    found_sub_file = None
    
    base_name = os.path.basename(base)
    
    # Look for subtitle files that match the video title
    for file in all_files:
        file_path = os.path.join("downloads", file)
        if (file.endswith('.srt') or file.endswith('.vtt')) and lang in file and base_name in file:
            print(f"Found matching subtitle file: {file}")
            found_sub_file = file_path
            subs = parse_subtitles(file_path)
            print(f"Parsed {len(subs)} subtitle entries")
            if subs:  # If we got valid subtitles, break
                break
    
    # Fallback: try exact patterns if the flexible search didn't work
    if not subs:
        possible_subs = [
            f"{base}.{lang}.srt",
            f"{base}.{lang}.vtt", 
            f"{base}.srt",
            f"{base}.vtt"
        ]
        
        for sub_file in possible_subs:
            print(f"Checking fallback pattern: {sub_file}")
            if os.path.exists(sub_file):
                print(f"Found subtitle file: {sub_file}")
                found_sub_file = sub_file
                subs = parse_subtitles(sub_file)
                print(f"Parsed {len(subs)} subtitle entries")
                if subs:  # If we got valid subtitles, break
                    break

    if not subs:
        print("No subtitles found or parsed successfully")
    else:
        print(f"Successfully loaded {len(subs)} subtitle entries from {found_sub_file}")

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "song": f"/downloads/{os.path.basename(song_file)}",
            "subs": subs,
            "subtitles": None,
            "url": None,
            "title": title,
            "thumbnail": thumbnail,
        }
    )