import logging
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg

logger = logging.getLogger(__name__)


def extract_audio_from_video(
    video_bytes: bytes,
    *,
    source_filename: str,
) -> tuple[bytes, str] | None:
    suffix = Path(source_filename).suffix or ".bin"
    try:
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:
        logger.warning("Bundled ffmpeg is unavailable: %s", e)
        return None

    with tempfile.TemporaryDirectory(prefix="fixghana-video-") as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / f"input{suffix}"
        output_path = temp_path / "audio.wav"
        input_path.write_bytes(video_bytes)

        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            str(output_path),
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0 or not output_path.exists():
            logger.warning("Video audio extraction failed: %s", result.stderr.strip())
            return None
        return output_path.read_bytes(), output_path.name
