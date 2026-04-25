import { workspace } from "vscode";

import { EXT_NAME } from "./utils/constants";

export type CamelCaseValues = false | true | "true" | "dashes";
export type AliasFromUserOptions = Record<string, string>;
export type AliasFromTsConfig = Record<string, string[]>;
export type PathAlias = AliasFromUserOptions | AliasFromTsConfig;

export interface ExtensionOptions {
	camelCase: CamelCaseValues;
	pathAlias: AliasFromUserOptions;
}

export type ExtensionOptionsProvider = ExtensionOptions | (() => ExtensionOptions);

export function resolveOptions(options: ExtensionOptionsProvider): ExtensionOptions {
	return typeof options === "function" ? options() : options;
}

export function readOptions(): ExtensionOptions {
	const configuration = workspace.getConfiguration(EXT_NAME);
	const camelCase = configuration.get<CamelCaseValues>("camelCase", false);
	const pathAlias = configuration.get<AliasFromUserOptions>("pathAlias", {});

	return {
		camelCase,
		pathAlias
	};
}
