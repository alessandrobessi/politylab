/// <reference lib="webworker" />
import { WorkerCore } from './core';
import { PUSH_INTERVAL_MS, type WorkerCommand } from './protocol';

/**
 * Web Worker host for the simulation (BLUEPRINT.md §34). All engine work happens
 * here so the UI thread stays responsive at 20×/100×. Logic lives in `WorkerCore`
 * (framework-free, `self`-free) so it is unit-tested in Node.
 */

const core = new WorkerCore();
let playTimer: ReturnType<typeof setInterval> | null = null;
let ticksPerSecond = 0;
let lastPush = 0;

function push(force = false): void {
	const now = Date.now();
	if (!force && now - lastPush < PUSH_INTERVAL_MS) return;
	lastPush = now;
	self.postMessage(core.snapshot(playTimer !== null));
}

function stopPlaying(): void {
	if (playTimer !== null) {
		clearInterval(playTimer);
		playTimer = null;
	}
}

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
	const cmd = e.data;
	switch (cmd.type) {
		case 'generate':
			stopPlaying();
			core.generate(cmd.seed);
			push(true);
			break;
		case 'load':
			stopPlaying();
			core.load(cmd.saved);
			push(true);
			break;
		case 'step':
			stopPlaying();
			core.run(1);
			push(true);
			break;
		case 'seek':
			core.seek(cmd.year);
			push(true);
			break;
		case 'resume':
			core.resume();
			push(true);
			break;
		case 'export':
			self.postMessage({ type: 'saved', saved: core.export() });
			break;
		case 'history': {
			const h = core.fullHistory();
			self.postMessage({ type: 'history', stats: h.stats, liveYear: h.liveYear });
			break;
		}
		case 'pause':
			stopPlaying();
			push(true);
			break;
		case 'play': {
			stopPlaying();
			ticksPerSecond = cmd.ticksPerSecond;
			// Run a small batch each frame; batch size scales with speed.
			const period = 40;
			const batch = Math.max(1, Math.round((ticksPerSecond * period) / 1000));
			playTimer = setInterval(() => {
				core.run(batch);
				push();
			}, period);
			push(true);
			break;
		}
	}
};
