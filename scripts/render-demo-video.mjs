import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceFile = path.join(rootDir, 'submission', 'video', 'scenes.json');
const generatedDir = path.join(rootDir, 'submission', 'video', 'generated');
const audioDir = path.join(generatedDir, 'audio');
const renderedAudioDir = path.join(generatedDir, 'rendered-audio');
const visualDir = path.join(generatedDir, 'visuals');
const segmentDir = path.join(generatedDir, 'segments');
const captionsFile = path.join(generatedDir, 'captions.srt');
const concatFile = path.join(generatedDir, 'segments.txt');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
const silent = process.argv.includes('--silent');
const joinedFile = path.join(generatedDir, silent ? 'joined-preview.mp4' : 'joined.mp4');
const outputFile = path.join(generatedDir, silent ? 'ChargeProof-demo-preview.mp4' : 'ChargeProof-demo.mp4');
const reportFile = path.join(generatedDir, silent ? 'video-preview-report.json' : 'video-report.json');

const scenes = JSON.parse(await readFile(sourceFile, 'utf8'));
validateScenes(scenes);
await mkdir(segmentDir, { recursive: true });
if (!silent) await mkdir(renderedAudioDir, { recursive: true });

const rendered = [];
let timeline = 0;
const captions = [];
for (const scene of scenes) {
  const visualFile = path.join(visualDir, scene.visual);
  await access(visualFile);
  const audioFile = path.join(audioDir, `${scene.id}.wav`);
  let duration = scene.targetSeconds;
  let audioTempo = 1;
  if (!silent) {
    await access(audioFile);
    const audioDuration = await probeDuration(audioFile);
    duration = Math.min(scene.targetSeconds, audioDuration + 0.5);
    const spokenWindow = scene.targetSeconds - 0.45;
    audioTempo = Math.max(1, audioDuration / spokenWindow);
    if (audioTempo > 1.4) {
      throw new Error(
        `${scene.id}: narration needs ${audioTempo.toFixed(2)}x compression; shorten or regenerate it`,
      );
    }
  }

  const segmentFile = path.join(segmentDir, `${scene.id}${silent ? '-silent' : ''}.mp4`);
  await renderSegment({ visualFile, audioFile, segmentFile, duration, audioTempo });
  if (!silent) {
    await extractRenderedAudio(segmentFile, path.join(renderedAudioDir, `${scene.id}.wav`));
  }
  rendered.push({ ...scene, duration, audioTempo, segmentFile });
  captions.push(...captionEntries(scene.narration, timeline, duration));
  timeline += duration;
  console.log(`${scene.id}: rendered ${duration.toFixed(2)} seconds`);
}

await writeFile(captionsFile, serializeCaptions(captions), 'utf8');
await writeFile(
  concatFile,
  rendered.map((scene) => `file '${ffmpegPath(scene.segmentFile)}'`).join('\n') + '\n',
  'utf8',
);

await runCommand(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatFile,
  '-c',
  'copy',
  joinedFile,
]);
await runCommand(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-i',
  joinedFile,
  '-i',
  captionsFile,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0',
  '-map',
  '1:0',
  '-c:v',
  'copy',
  '-c:a',
  'copy',
  '-c:s',
  'mov_text',
  '-metadata',
  'title=ChargeProof — Trustless cross-chain EV charging settlement',
  '-metadata:s:s:0',
  'language=eng',
  '-movflags',
  '+faststart',
  outputFile,
]);

const outputBytes = await readFile(outputFile);
const outputDuration = await probeDuration(outputFile);
if (outputDuration < 150 || outputDuration > 190) {
  throw new Error(`Rendered duration ${outputDuration.toFixed(2)}s is outside the 150–190s demo range`);
}
const report = {
  renderedAt: new Date().toISOString(),
  silentPreview: silent,
  durationSeconds: outputDuration,
  sha256: createHash('sha256').update(outputBytes).digest('hex'),
  bytes: outputBytes.length,
  videoCodec: 'H.264',
  audioCodec: 'AAC',
  subtitleCodec: 'mov_text',
  scenes: rendered.map(({ id, title, duration, audioTempo, visual }) => ({
    id,
    title,
    duration,
    audioTempo,
    visual,
  })),
};
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  `${silent ? 'Silent preview' : 'Final MiMo-narrated video'} ready: ${path.relative(rootDir, outputFile)} (${outputDuration.toFixed(2)}s)`,
);

async function renderSegment({ visualFile, audioFile, segmentFile, duration, audioTempo }) {
  const fadeOutStart = Math.max(0, duration - 0.25).toFixed(3);
  const videoFilter = [
    'scale=1920:1080:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x02070c',
    'setsar=1',
    'fade=t=in:st=0:d=0.25',
    `fade=t=out:st=${fadeOutStart}:d=0.25`,
    'format=yuv420p',
  ].join(',');
  const audioFilter = [
    `atempo=${audioTempo.toFixed(6)}`,
    'volume=-1dB',
    'apad',
    `atrim=0:${duration.toFixed(3)}`,
    'afade=t=in:st=0:d=0.15',
    `afade=t=out:st=${fadeOutStart}:d=0.25`,
  ].join(',');
  const inputArgs = silent
    ? ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
    : ['-i', audioFile];

  await runCommand(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-i',
    visualFile,
    ...inputArgs,
    '-vf',
    videoFilter,
    '-af',
    audioFilter,
    '-t',
    duration.toFixed(3),
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    '-shortest',
    segmentFile,
  ]);
}

async function probeDuration(filename) {
  const output = await runCommand(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filename,
    ],
    true,
  );
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine media duration for ${filename}`);
  }
  return duration;
}

async function extractRenderedAudio(segmentFile, outputFile) {
  await runCommand(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    segmentFile,
    '-map',
    '0:a:0',
    '-c:a',
    'pcm_s16le',
    '-ar',
    '48000',
    '-ac',
    '1',
    outputFile,
  ]);
}

function captionEntries(narration, sceneStart, sceneDuration) {
  const words = narration.trim().split(/\s+/);
  const chunks = [];
  for (let index = 0; index < words.length; index += 11) {
    chunks.push(words.slice(index, index + 11).join(' '));
  }
  const totalWords = chunks.reduce((sum, chunk) => sum + chunk.split(/\s+/).length, 0);
  let elapsed = sceneStart;
  return chunks.map((text, index) => {
    const wordCount = text.split(/\s+/).length;
    const isLast = index === chunks.length - 1;
    const chunkDuration = isLast
      ? sceneStart + sceneDuration - elapsed
      : (sceneDuration * wordCount) / totalWords;
    const entry = { start: elapsed, end: elapsed + chunkDuration, text };
    elapsed += chunkDuration;
    return entry;
  });
}

function serializeCaptions(entries) {
  return (
    entries
      .map(
        (entry, index) => `${index + 1}\n${srtTime(entry.start)} --> ${srtTime(entry.end)}\n${entry.text}\n`,
      )
      .join('\n') + '\n'
  );
}

function srtTime(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(wholeSeconds, 2)},${pad(remainder, 3)}`;
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function ffmpegPath(filename) {
  return filename.replaceAll('\\', '/').replaceAll("'", "'\\''");
}

async function runCommand(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      windowsHide: true,
    });
    let output = '';
    if (capture) child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function validateScenes(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('scenes.json must be a non-empty array');
  for (const scene of value) {
    if (
      !scene ||
      typeof scene.id !== 'string' ||
      typeof scene.title !== 'string' ||
      typeof scene.visual !== 'string' ||
      typeof scene.narration !== 'string' ||
      !Number.isFinite(scene.targetSeconds) ||
      scene.targetSeconds <= 0
    ) {
      throw new Error('Every scene requires id, title, visual, narration, and targetSeconds');
    }
  }
}
