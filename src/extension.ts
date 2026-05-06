import { type DocumentFilter, type ExtensionContext, languages } from "vscode";

import { createCSSModuleCompletionProvider } from "./completion-provider";
import { registerCreateCssModuleCommand } from "./create-css-module-command";
import { createCSSModuleDefinitionProvider } from "./definition-provider";
import { readOptions, subscribeToConfigChanges } from "./options";
import { createCSSModuleReferenceProvider } from "./reference-provider";
import { createCSSModuleRenameProvider } from "./rename-provider";
import { registerToggleCssModuleCommand } from "./toggle-css-module-command";
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
	const styleMode: DocumentFilter[] = renameMode.slice(mode.length);
	const definitionMode: DocumentFilter[] = [
		...mode.map(filter => ({ ...filter, pattern: "**/*" })),
		...styleMode.map(filter => ({ ...filter, pattern: "**/*.module.{css,scss,sass,less,styl,stylus}" }))
	];
	context.subscriptions.push(
		languages.registerCompletionItemProvider(mode, createCSSModuleCompletionProvider(readOptions), ".", '"', "'"),
		languages.registerDefinitionProvider(definitionMode, createCSSModuleDefinitionProvider(readOptions)),
		languages.registerReferenceProvider(styleMode, createCSSModuleReferenceProvider()),
		languages.registerRenameProvider(renameMode, createCSSModuleRenameProvider(readOptions)),
		registerCreateCssModuleCommand(),
		registerToggleCssModuleCommand()
	);

	context.subscriptions.push(subscribeToConfigChanges(), ...subscribeToTsConfigChanges());
}

export function deactivate(): void {}
