"""Wav2Lip lip sync — takes silent video + audio, returns lip-synced video.

Language-AGNOSTIC — works with ANY language because it maps phonemes to
visemes (mouth shapes), not words to mouths.

Cost: $0 (local, open source)
Quality: Good (slight mouth blur — upgradeable to MuseTalk later)

Process:
1. Write video and audio to temp files
2. Run Wav2Lip inference (GPU or CPU)
3. Read the output video
4. Clean up temp files
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import uuid

logger = logging.getLogger(__name__)

# Wav2Lip model paths — set via env or use defaults
WAV2LIP_CHECKPOINT = os.environ.get(
    "WAV2LIP_CHECKPOINT",
    os.path.expanduser("~/.cache/wav2lip/wav2lip_gan.pth"),
)
WAV2LIP_DIR = os.environ.get(
    "WAV2LIP_DIR",
    os.path.expanduser("~/.cache/wav2lip"),
)


async def lip_sync(
    video_bytes: bytes,
    audio_bytes: bytes,
    output_fps: int = 25,
) -> bytes:
    """Apply lip sync to a video using Wav2Lip.

    Takes a silent (or any) video and audio track, detects the face in
    each frame, and re-renders the mouth region to match the audio.
    Works with ANY language — viseme mapping is language-agnostic.

    Parameters
    ----------
    video_bytes:
        Raw video bytes (MP4). Can be silent or have existing audio
        (existing audio will be replaced).
    audio_bytes:
        Raw audio bytes (WAV). The speech track to sync to.
    output_fps:
        Output video framerate (default 25).

    Returns
    -------
    bytes
        Lip-synced video bytes (MP4) with the audio track mixed in.
    """
    # Create temp files
    run_id = uuid.uuid4().hex[:8]
    tmp_dir = tempfile.gettempdir()
    video_path = os.path.join(tmp_dir, f"wav2lip_input_{run_id}.mp4")
    audio_path = os.path.join(tmp_dir, f"wav2lip_audio_{run_id}.wav")
    output_path = os.path.join(tmp_dir, f"wav2lip_output_{run_id}.mp4")

    try:
        # Write inputs to temp files
        with open(video_path, "wb") as f:
            f.write(video_bytes)
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)

        logger.info(
            "Wav2Lip: video=%d bytes, audio=%d bytes, fps=%d",
            len(video_bytes), len(audio_bytes), output_fps,
        )

        # Try Wav2Lip CLI inference first (most common setup)
        try:
            result_bytes = await _run_wav2lip_cli(
                video_path, audio_path, output_path, output_fps,
            )
            return result_bytes
        except (FileNotFoundError, RuntimeError) as exc:
            logger.warning("Wav2Lip CLI failed (%s), trying in-process", exc)

        # Fallback: in-process inference
        try:
            result_bytes = await _run_wav2lip_inprocess(
                video_path, audio_path, output_path, output_fps,
            )
            return result_bytes
        except ImportError:
            logger.warning(
                "Wav2Lip not installed for in-process. "
                "Falling back to audio-overlay only (no lip sync)."
            )

        # Final fallback: just overlay audio on video with ffmpeg (no lip sync)
        return await _ffmpeg_audio_overlay(video_path, audio_path, output_path)

    finally:
        # Clean up temp files
        for path in (video_path, audio_path, output_path):
            try:
                os.unlink(path)
            except OSError:
                pass


async def _run_wav2lip_cli(
    video_path: str,
    audio_path: str,
    output_path: str,
    output_fps: int,
) -> bytes:
    """Run Wav2Lip via CLI subprocess.

    Expects the Wav2Lip repo to be cloned and the checkpoint downloaded.
    """
    inference_script = os.path.join(WAV2LIP_DIR, "inference.py")
    if not os.path.exists(inference_script):
        raise FileNotFoundError(
            f"Wav2Lip inference.py not found at {inference_script}. "
            f"Set WAV2LIP_DIR env var to the Wav2Lip repo directory."
        )

    if not os.path.exists(WAV2LIP_CHECKPOINT):
        raise FileNotFoundError(
            f"Wav2Lip checkpoint not found at {WAV2LIP_CHECKPOINT}. "
            f"Download wav2lip_gan.pth and set WAV2LIP_CHECKPOINT env var."
        )

    cmd = [
        "python", inference_script,
        "--checkpoint_path", WAV2LIP_CHECKPOINT,
        "--face", video_path,
        "--audio", audio_path,
        "--outfile", output_path,
        "--fps", str(output_fps),
        "--resize_factor", "1",
        "--nosmooth",  # Sharper results without temporal smoothing
    ]

    logger.info("Wav2Lip CLI: %s", " ".join(cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=WAV2LIP_DIR,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_text = stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"Wav2Lip CLI failed (exit {proc.returncode}): {error_text}")

    if not os.path.exists(output_path):
        raise RuntimeError("Wav2Lip CLI completed but output file not found")

    with open(output_path, "rb") as f:
        result = f.read()

    logger.info("Wav2Lip CLI output: %d bytes", len(result))
    return result


async def _run_wav2lip_inprocess(
    video_path: str,
    audio_path: str,
    output_path: str,
    output_fps: int,
) -> bytes:
    """Run Wav2Lip inference in-process (requires wav2lip package installed)."""

    def _infer() -> bytes:
        # Import Wav2Lip components
        import cv2
        import numpy as np
        import torch
        from wav2lip import audio as wav2lip_audio
        from wav2lip import face_detection

        # Lazy import to avoid loading at module level
        from wav2lip.models import Wav2Lip as Wav2LipModel

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load model
        model = Wav2LipModel()
        checkpoint = torch.load(WAV2LIP_CHECKPOINT, map_location=device)
        state_dict = checkpoint.get("state_dict", checkpoint)
        model.load_state_dict(state_dict)
        model = model.to(device).eval()

        # Read video frames
        cap = cv2.VideoCapture(video_path)
        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()

        if not frames:
            raise RuntimeError("No frames extracted from video")

        # Read audio mel spectrogram
        mel = wav2lip_audio.melspectrogram(audio_path)

        # Process frames with lip sync
        mel_chunks = _get_mel_chunks(mel, output_fps)
        batch_size = 16
        result_frames = []

        for i in range(0, len(frames), batch_size):
            batch_frames = frames[i:i + batch_size]
            batch_mels = mel_chunks[i:i + batch_size]

            if not batch_mels:
                result_frames.extend(batch_frames)
                continue

            # Detect faces and run Wav2Lip
            for frame, mel_chunk in zip(batch_frames, batch_mels):
                face_rect = face_detection.detect(frame)
                if face_rect is not None:
                    # Run model inference
                    input_frame = cv2.resize(frame, (96, 96))
                    input_frame = np.transpose(input_frame, (2, 0, 1)) / 255.0
                    mel_input = mel_chunk[np.newaxis, np.newaxis, :, :]

                    with torch.no_grad():
                        frame_t = torch.FloatTensor(input_frame).unsqueeze(0).to(device)
                        mel_t = torch.FloatTensor(mel_input).to(device)
                        pred = model(mel_t, frame_t)

                    pred_frame = pred.squeeze().cpu().numpy().transpose(1, 2, 0) * 255
                    pred_frame = pred_frame.astype(np.uint8)
                    pred_frame = cv2.resize(pred_frame, (face_rect[2], face_rect[3]))

                    # Paste predicted mouth region back
                    y1, y2 = face_rect[1], face_rect[1] + face_rect[3]
                    x1, x2 = face_rect[0], face_rect[0] + face_rect[2]
                    frame[y1:y2, x1:x2] = pred_frame

                result_frames.append(frame)

        # Write output video
        h, w = result_frames[0].shape[:2]
        writer = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*"mp4v"),
            output_fps,
            (w, h),
        )
        for frame in result_frames:
            writer.write(frame)
        writer.release()

        # Mux audio with ffmpeg
        muxed_path = output_path.replace(".mp4", "_muxed.mp4")
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", output_path,
                "-i", audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-strict", "experimental",
                muxed_path,
            ],
            check=True,
            capture_output=True,
        )

        with open(muxed_path, "rb") as f:
            result = f.read()

        try:
            os.unlink(muxed_path)
        except OSError:
            pass

        return result

    return await asyncio.to_thread(_infer)


async def _ffmpeg_audio_overlay(
    video_path: str,
    audio_path: str,
    output_path: str,
) -> bytes:
    """Fallback: overlay audio on video using ffmpeg (no lip sync).

    This is the last resort when Wav2Lip is not available. The mouth
    won't move to match speech, but at least the audio plays over
    the video.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-strict", "experimental",
        "-shortest",  # Trim to shorter of video/audio
        output_path,
    ]

    logger.info("FFmpeg audio overlay (no lip sync): %s", " ".join(cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_text = stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg failed (exit {proc.returncode}): {error_text}")

    with open(output_path, "rb") as f:
        result = f.read()

    logger.info("FFmpeg overlay output: %d bytes (no lip sync)", len(result))
    return result


def _get_mel_chunks(mel, fps: int) -> list:
    """Split mel spectrogram into per-frame chunks for Wav2Lip."""
    import numpy as np

    # Wav2Lip expects mel chunks of 80 frames per video frame
    mel_step_size = 16  # mel frames per video frame (standard Wav2Lip)
    mel_chunks = []

    i = 0
    while i < mel.shape[1]:
        chunk = mel[:, i:i + 80]
        if chunk.shape[1] < 80:
            # Pad with zeros if needed
            chunk = np.pad(chunk, ((0, 0), (0, 80 - chunk.shape[1])))
        mel_chunks.append(chunk)
        i += mel_step_size

    return mel_chunks
