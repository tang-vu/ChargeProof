import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { workerStateSchema, type WorkerState } from './model.js';

export class FileStateStore {
  public constructor(private readonly directory: string) {}

  public statePath(transactionHash: string): string {
    return path.join(this.directory, `${transactionHash.toLowerCase()}.json`);
  }

  public async load(transactionHash: string): Promise<WorkerState | undefined> {
    try {
      const raw = await readFile(this.statePath(transactionHash), 'utf8');
      return workerStateSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  public async save(state: WorkerState): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const destination = this.statePath(state.transactionHash);
    const temporary = `${destination}.${process.pid}.tmp`;
    const validated = workerStateSchema.parse(state);
    await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, destination);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
