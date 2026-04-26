import { performance } from "node:perf_hooks";

import type { OutputChannel } from "vscode";

import { readOptions } from "../options";

const OUTPUT_CHANNEL_NAME = "Enhanced CSS Modules Performance";
let performanceOutputChannel: OutputChannel | null = null;

export function getPerformanceOutputChannelName(): string {
	return OUTPUT_CHANNEL_NAME;
}

export function setPerformanceOutputChannel(outputChannel: OutputChannel): void {
	performanceOutputChannel = outputChannel;
}

export async function measurePerformance<T>(
	label: string,
	operation: () => Promise<T>,
	enabled = readOptions().debugPerformance
): Promise<T> {
	if (!enabled) {
		return operation();
	}

	const start = performance.now();
	try {
		return await operation();
	} finally {
		logPerformance(label, start);
	}
}

export function logPerformance(label: string, start: number, enabled = readOptions().debugPerformance): void {
	if (!enabled) {
		return;
	}

	const duration = performance.now() - start;
	const message = `${label}: ${duration.toFixed(1)}ms`;
	if (performanceOutputChannel) {
		performanceOutputChannel.appendLine(message);
		return;
	}

	console.info(`[${OUTPUT_CHANNEL_NAME}] ${message}`);
}

export function now(): number {
	return performance.now();
}
