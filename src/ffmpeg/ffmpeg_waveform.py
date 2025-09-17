import subprocess
import shutil
import math
from typing import Tuple, Generator, Optional

import numpy as np

class FFmpegNotFoundError(RuntimeError):
    pass

def _ffmpeg_check():
    """Ensure ffmpeg exists in PATH."""
    ff = shutil.which("ffmpeg")
    if ff is None:
        raise FFmpegNotFoundError(
            "ffmpeg not found in PATH. Install ffmpeg and ensure it's available in the PATH."
        )
    return ff

def _spawn_ffmpeg_proc(input_path: str, sample_rate: int) -> subprocess.Popen:
    ffmpeg = _ffmpeg_check()
    cmd = [
        ffmpeg,
        "-v",
        "error",
        "-i",
        input_path,
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-",
    ]
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=10**6,
    )
    if proc.stdout is None:
        raise RuntimeError("Failed to open ffmpeg stdout pipe.")
    return proc

def _bytes_to_int16(arr_bytes: bytes) -> np.ndarray:
    if len(arr_bytes) == 0:
        return np.empty(0, dtype=np.int16)
    if len(arr_bytes) % 2 != 0:
        arr_bytes = arr_bytes[:-1]
    return np.frombuffer(arr_bytes, dtype=np.int16)

def _compute_frame_amplitude(samples: np.ndarray, method: str) -> float:
    if samples.size == 0:
        return 0.0
    if method == "rms":
        f = samples.astype(np.float32)
        rms = math.sqrt(np.mean(f * f))
        return float(rms / 32767.0)
    elif method == "peak":
        peak = float(np.max(np.abs(samples)))
        return float(peak / 32767.0)
    else:
        raise ValueError("Unknown method: choose 'rms' or 'peak'")

def waveform_stream(
    input_path: str,
    ms_resolution: int = 1,
    method: str = "rms",
    sample_rate: int = 48000,
) -> Generator[Tuple[int, float], None, None]:

    if ms_resolution <= 0:
        raise ValueError("ms_resolution must be >= 1")
    if method not in ("rms", "peak"):
        raise ValueError("method must be 'rms' or 'peak'")

    samples_per_ms = sample_rate / 1000.0 * ms_resolution
    bytes_per_sample = 2
    internal_ms_chunk = 50
    internal_samples = int(round(samples_per_ms * (internal_ms_chunk / ms_resolution)))
    if internal_samples <= 0:
        internal_samples = int(round(sample_rate * internal_ms_chunk / 1000.0))
    bytes_to_read = internal_samples * bytes_per_sample

    proc = _spawn_ffmpeg_proc(input_path, sample_rate)

    leftover = np.empty(0, dtype=np.int16)
    time_ms = 0

    try:
        while True:
            raw = proc.stdout.read(bytes_to_read)
            if not raw:
                break
            chunk_samples = _bytes_to_int16(raw)
            if chunk_samples.size == 0:
                continue
            if leftover.size:
                chunk_samples = np.concatenate((leftover, chunk_samples))
                leftover = np.empty(0, dtype=np.int16)

            samples_this_block = int(round(samples_per_ms))
            if samples_this_block <= 0:
                samples_this_block = 1

            idx = 0
            total = chunk_samples.size
            while idx + samples_this_block <= total:
                block = chunk_samples[idx : idx + samples_this_block]
                amp = _compute_frame_amplitude(block, method)
                yield (time_ms, amp)
                time_ms += ms_resolution
                idx += samples_this_block

            if idx < total:
                leftover = chunk_samples[idx:]
            else:
                leftover = np.empty(0, dtype=np.int16)

        if leftover.size:
            amp = _compute_frame_amplitude(leftover, method)
            yield (time_ms, amp)

        proc.stdout.close()
        proc.wait(timeout=5)
    finally:
        try:
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass

def waveform_from_file(
    input_path: str,
    ms_resolution: int = 1,
    method: str = "rms",
    sample_rate: int = 48000,
    dtype: Optional[type] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """Return full waveform as (times_ms, amplitudes)."""
    if ms_resolution <= 0:
        raise ValueError("ms_resolution must be >= 1")
    if method not in ("rms", "peak"):
        raise ValueError("method must be 'rms' or 'peak'")

    proc  = _spawn_ffmpeg_proc(input_path, sample_rate)
    raw = proc.stdout.read()
    proc.stdout.close()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass

    samples = _bytes_to_int16(raw)
    if samples.size == 0:
        return np.empty(0, dtype=np.int32), np.empty(0, dtype=np.float32)

    samples_per_ms = sample_rate * ms_resolution / 1000.0
    total_ms_frames = int(math.ceil(samples.size / samples_per_ms))

    amplitudes = np.empty(total_ms_frames, dtype=np.float32)
    times = np.arange(total_ms_frames, dtype=np.int32) * ms_resolution

    for i in range(total_ms_frames):
        start = int(round(i * samples_per_ms))
        end = int(round((i + 1) * samples_per_ms))
        block = samples[start:end] if start < samples.size else np.empty(0, dtype=np.int16)
        amplitudes[i] = _compute_frame_amplitude(block, method)

    if dtype is not None:
        amplitudes = amplitudes.astype(dtype)

    return times, amplitudes
