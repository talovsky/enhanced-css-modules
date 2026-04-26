import { type DocumentFilter, type ExtensionContext, languages, window } from "vscode";

import { createCSSModuleCompletionProvider } from "./completion-provider";
import { registerCreateCssModuleCommand } from "./create-css-module-command";
import { createCSSModuleDefinitionProvider } from "./definition-provider";
import { readOptions, subscribeToConfigChanges } from "./options";
import { createCSSModuleRenameProvider } from "./rename-provider";
import { registerToggleCssModuleCommand } from "./toggle-css-module-command";
import { getPerformanceOutputChannelName, setPerformanceOutputChannel } from "./utils/performance";
import { subscribeToTsConfigChanges } from "./utils/ts-alias";

export function activate(context: ExtensionContext): void {
	const mode: DocumentFilter[] = [
		{ language: "typescriptreact", scheme: "file" },
		{ language: "javascriptreact", scheme: "file" },
		{ language: "javascript", scheme: "file" },
		{ language: "typescript", scheme: "file" },
		{ language: "astro", scheme: "file" }
	];
	const renameMode: DocumentFilter[] = [
		...mode,
		{ language: "css", scheme: "file" },
		{ language: "scss", scheme: "file" },
		{ language: "sass", scheme: "file" },
		{ language: "less", scheme: "file" },
		{ language: "stylus", scheme: "file" }
	];
	const performanceOutputChannel = window.createOutputChannel(getPerformanceOutputChannelName());
	setPerformanceOutputChannel(performanceOutputChannel);

	context.subscriptions.push(
		performanceOutputChannel,
		languages.registerCompletionItemProvider(mode, createCSSModuleCompletionProvider(readOptions), ".", '"', "'"),
		languages.registerDefinitionProvider(mode, createCSSModuleDefinitionProvider(readOptions)),
		languages.registerRenameProvider(renameMode, createCSSModuleRenameProvider(readOptions)),
		registerCreateCssModuleCommand(),
		registerToggleCssModuleCommand()
	);

	context.subscriptions.push(subscribeToConfigChanges(), ...subscribeToTsConfigChanges());
}

export function deactivate(): void {}
