import { type Disposable, workspace } from "vscode";

import { EXT_NAME } from "./utils/constants";

export type AliasFromUserOptions = Record<string, string>;
export type AliasFromTsConfig = Record<string, string[]>;
export type PathAlias = AliasFromUserOptions | AliasFromTsConfig;

export interface ExtensionOptions {
	createCssModuleTargetFolder: string;
	debugPerformance: boolean;
	pathAlias: AliasFromUserOptions;
}

export type ExtensionOptionsProvider = ExtensionOptions | (() => ExtensionOptions);

export function resolveOptions(options: ExtensionOptionsProvider): ExtensionOptions {
	return typeof options === "function" ? options() : options;
}

let cachedOptions: ExtensionOptions | null = null;

export function readOptions(): ExtensionOptions {
	if (cachedOptions) {
		return cachedOptions;
	}

	const configuration = workspace.getConfiguration(EXT_NAME);
	cachedOptions = {
		createCssModuleTargetFolder: configuration.get<string>("createCssModule.targetFolder", ""),
		debugPerformance: configuration.get<boolean>("debugPerformance", false),
		pathAlias: configuration.get<AliasFromUserOptions>("pathAlias", {})
	};

	return cachedOptions;
}

export function subscribeToConfigChanges(): Disposable {
	return workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(EXT_NAME)) {
			cachedOptions = null;
		}
	});
}
