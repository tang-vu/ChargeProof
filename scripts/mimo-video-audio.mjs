import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });
const sourceFile = path.join(rootDir, 'submission', 'video', 'scenes.json');
const generatedDir = path.join(rootDir, 'submission', 'video', 'generated');
const rendered = process.argv.includes('--rendered');
const audioDir = path.join(generatedDir, rendered ? 'rendered-audio' : 'audio');
const transcriptDir = path.join(generatedDir, rendered ? 'transcripts-rendered' : 'transcripts');
const reportFile = path.join(generatedDir, rendered ? 'asr-rendered-report.json' : 'asr-report.json');

const apiKey = process.env.MIMO_API_KEY;
const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/$/, '');
const authMode = (process.env.MIMO_AUTH_HEADER ?? 'authorization').toLowerCase();
const voice = process.env.MIMO_TTS_VOICE ?? 'Milo';
const maximumWordErrorRate = Number(process.env.MIMO_ASR_MAX_WER ?? '0.18');
const force = process.argv.includes('--force');
const sceneArgument = process.argv.find((argument) => argument.startsWith('--scene='));
const selectedSceneId = sceneArgument?.slice('--scene='.length);
const requestedMode = process.argv.includes('--tts-only')
  ? 'tts'
  : process.argv.includes('--asr-only')
    ? 'asr'
    : 'all';

if (!apiKey) {
  throw new Error(
    'MIMO_API_KEY is not set. Revoke any key exposed in chat, then set a replacement only in the local terminal environment.',
  );
}
if (!Number.isFinite(maximumWordErrorRate) || maximumWordErrorRate < 0) {
  throw new Error('MIMO_ASR_MAX_WER must be a non-negative number');
}
if (!['authorization', 'api-key'].includes(authMode)) {
  throw new Error('MIMO_AUTH_HEADER must be either authorization or api-key');
}
if (rendered && requestedMode !== 'asr') {
  throw new Error('--rendered is valid only together with --asr-only');
}
if (selectedSceneId && requestedMode !== 'tts') {
  throw new Error('--scene is supported only together with --tts-only');
}

const allScenes = JSON.parse(await readFile(sourceFile, 'utf8'));
validateScenes(allScenes);
const scenes = selectedSceneId ? allScenes.filter((scene) => scene.id === selectedSceneId) : allScenes;
if (scenes.length === 0) throw new Error(`Unknown scene id: ${selectedSceneId}`);
await mkdir(audioDir, { recursive: true });
await mkdir(transcriptDir, { recursive: true });

const results = [];
for (const scene of scenes) {
  const audioFile = path.join(audioDir, `${scene.id}.wav`);
  if (requestedMode !== 'asr') {
    const existing = await fileExists(audioFile);
    if (existing && !force) {
      console.log(`${scene.id}: retained existing TTS audio`);
    } else {
      const result = await synthesize(scene.narration);
      await writeFile(audioFile, result.audio);
      console.log(`${scene.id}: MiMo TTS audio generated (${result.audio.length} bytes)`);
    }
  }

  if (requestedMode !== 'tts') {
    if (!(await fileExists(audioFile))) {
      throw new Error(`${scene.id}: audio is missing; run without --asr-only first`);
    }
    const audio = await readFile(audioFile);
    const transcript = await transcribe(audio);
    const metrics = compareText(scene.narration, transcript);
    await writeFile(path.join(transcriptDir, `${scene.id}.txt`), `${transcript.trim()}\n`, 'utf8');
    results.push({
      id: scene.id,
      expectedWords: metrics.expectedWords,
      transcriptWords: metrics.transcriptWords,
      edits: metrics.edits,
      wordErrorRate: metrics.wordErrorRate,
      passed: metrics.wordErrorRate <= maximumWordErrorRate,
    });
    console.log(`${scene.id}: MiMo ASR WER ${(metrics.wordErrorRate * 100).toFixed(1)}%`);
  }
}

if (requestedMode !== 'tts') {
  const totals = results.reduce(
    (sum, item) => ({ words: sum.words + item.expectedWords, edits: sum.edits + item.edits }),
    { words: 0, edits: 0 },
  );
  const aggregateWordErrorRate = totals.words === 0 ? 0 : totals.edits / totals.words;
  const report = {
    generatedAt: new Date().toISOString(),
    ttsModel: 'mimo-v2.5-tts',
    asrModel: 'mimo-v2.5-asr',
    audioSource: rendered ? 'rendered video segments' : 'source TTS WAV files',
    voice,
    maximumWordErrorRate,
    aggregateWordErrorRate,
    scenes: results,
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (results.some((item) => !item.passed)) {
    throw new Error(
      `MiMo ASR validation failed; one or more scenes exceeded ${(maximumWordErrorRate * 100).toFixed(1)}% WER`,
    );
  }
  console.log(`MiMo ASR validation passed at ${(aggregateWordErrorRate * 100).toFixed(1)}% aggregate WER.`);
}

async function synthesize(text) {
  const payload = {
    model: 'mimo-v2.5-tts',
    messages: [
      {
        role: 'user',
        content:
          'Confident technology documentary narration in neutral international English. Precise, energetic but restrained, with clear blockchain terminology and a medium-fast pace. Pronounce Attestcoin as uh-TEST-coin, Creditcoin as CREDIT-coin, and ChargeProof as Charge Proof.',
      },
      { role: 'assistant', content: text },
    ],
    audio: { format: 'wav', voice },
  };
  const response = await callMiMo(payload, 'TTS');
  const encoded = response?.choices?.[0]?.message?.audio?.data;
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('MiMo TTS returned no audio data');
  }
  const audio = Buffer.from(encoded, 'base64');
  if (audio.subarray(0, 4).toString('ascii') !== 'RIFF') {
    throw new Error('MiMo TTS response is not a WAV file');
  }
  return { audio };
}

async function transcribe(audio) {
  const payload = {
    model: 'mimo-v2.5-asr',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: `data:audio/wav;base64,${audio.toString('base64')}`,
              format: 'wav',
            },
          },
        ],
      },
    ],
    asr_options: { language: 'en' },
  };
  const response = await callMiMo(payload, 'ASR');
  const transcript = response?.choices?.[0]?.message?.content;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    throw new Error('MiMo ASR returned no transcript');
  }
  return transcript;
}

async function callMiMo(payload, operation) {
  const headers = { 'content-type': 'application/json' };
  if (authMode === 'api-key') headers['api-key'] = apiKey;
  else headers.authorization = `Bearer ${apiKey}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      if (attempt < 3) {
        console.warn(`MiMo ${operation} network attempt ${attempt} failed; retrying.`);
        await delay(attempt * 2_000);
        continue;
      }
      const message = error instanceof Error ? error.message : 'network request failed';
      throw new Error(`MiMo ${operation} request failed after ${attempt} attempts: ${message}`, {
        cause: error,
      });
    }
    if (response.ok) {
      try {
        return await response.json();
      } catch (error) {
        if (attempt < 3) {
          console.warn(`MiMo ${operation} response attempt ${attempt} timed out; retrying.`);
          await delay(attempt * 2_000);
          continue;
        }
        const message = error instanceof Error ? error.message : 'response body could not be read';
        throw new Error(`MiMo ${operation} response failed after ${attempt} attempts: ${message}`, {
          cause: error,
        });
      }
    }

    const body = await safeJson(response);
    const reason = body?.error?.message ?? body?.message ?? response.statusText;
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      console.warn(`MiMo ${operation} returned HTTP ${response.status}; retrying.`);
      await delay(attempt * 2_000);
      continue;
    }
    throw new Error(`MiMo ${operation} returned HTTP ${response.status}: ${String(reason)}`);
  }
  throw new Error(`MiMo ${operation} exhausted retry attempts`);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function compareText(expected, actual) {
  const expectedTokens = normalize(expected);
  const actualTokens = normalize(actual);
  const edits = levenshtein(expectedTokens, actualTokens);
  return {
    expectedWords: expectedTokens.length,
    transcriptWords: actualTokens.length,
    edits,
    wordErrorRate: expectedTokens.length === 0 ? 0 : edits / expectedTokens.length,
  };
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replaceAll('u s d c', 'usdc')
    .replaceAll('s d k', 'sdk')
    .replaceAll('m v p', 'mvp')
    .replaceAll('o c p p', 'ocpp')
    .replaceAll('o c p i', 'ocpi')
    .replaceAll('eleven million five hundred thirty nine thousand eight hundred seventy four', '11 539 874')
    .replaceAll('one point four seven', '1 47')
    .replaceAll('three point five three', '3 53')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

async function fileExists(filename) {
  try {
    await readFile(filename);
    return true;
  } catch {
    return false;
  }
}

function validateScenes(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('scenes.json must be a non-empty array');
  for (const scene of value) {
    if (
      !scene ||
      typeof scene.id !== 'string' ||
      typeof scene.narration !== 'string' ||
      scene.narration.trim().length === 0
    ) {
      throw new Error('Every scene requires an id and narration');
    }
  }
}
