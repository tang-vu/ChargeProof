# ChargeProof demo video pipeline

This pipeline produces a 2.5–3 minute English demo video from public ChargeProof visuals, MiMo V2.5
speech synthesis, and MiMo V2.5 speech recognition. Generated media is intentionally Git-ignored.
It follows Xiaomi's official [TTS API](https://mimo.mi.com/docs/en-US/api/audio/tts) and
[ASR API](https://mimo.mi.com/docs/en-US/api/audio/Speech-Recognition), both using the OpenAI-compatible
`POST /v1/chat/completions` interface.

## Secret safety

Never paste an API key into chat, a command argument, source code, or a committed file. If a key was
ever pasted into a conversation, revoke it before continuing. Create a replacement dedicated key and
set it only in the current terminal session:

```powershell
$env:MIMO_API_KEY = Read-Host "MiMo API key"
$env:MIMO_BASE_URL = "https://token-plan-sgp.xiaomimimo.com/v1"
```

The scripts never print the key or serialize it into a report. The Token Plan terms shown in the MiMo
console restrict plan keys to interactive use with compatible coding and agent tools. Confirm that a
one-off, user-invoked media generation run is permitted for the account; otherwise use a standard
pay-as-you-go MiMo API key with `https://api.xiaomimimo.com/v1`.

## Generate

Prerequisites: Node.js 24, Chrome, FFmpeg, FFprobe, and `pdftoppm`.

```powershell
pnpm video:visuals
pnpm video:preview
pnpm video:audio
pnpm video:render
```

`video:preview` makes a silent composition check without credentials. `video:audio` generates one WAV
per scene with `mimo-v2.5-tts`, sends each WAV to `mimo-v2.5-asr`, and fails if the word error rate is
above `MIMO_ASR_MAX_WER`. `video:render` creates the final H.264/AAC MP4 with an English subtitle track.

Outputs are written under `submission/video/generated/`:

- `audio/*.wav`: scene narration;
- `transcripts/*.txt`: independent ASR transcripts;
- `asr-report.json`: per-scene and aggregate word error rate;
- `visuals/*.png`: public dashboard and deck captures;
- `captions.srt`: subtitle source;
- `ChargeProof-demo-preview.mp4`: silent composition check;
- `ChargeProof-demo.mp4`: final upload candidate;
- `video-report.json`: duration, SHA-256, and source metadata.

Review the entire MP4 before uploading. The final upload and DoraHacks submission remain human-only
actions because they require account access and editorial approval.
