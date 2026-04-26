import { workspace } from "vscode";

import { EXT_NAME } from "./utils/constants";

export type CamelCaseValues = false | true | "true" | "dashes";
export type AliasFromUserOptions = Record<string, string>;
export type AliasFromTsConfig = Record<string, string[]>;
export type PathAlias = AliasFromUserOptions | AliasFromTsConfig;

export interface ExtensionOptions {
	camelCase: CamelCaseValues;
	createCssModuleTargetFolder: string;
	pathAlias: AliasFromUserOptions;
}

export type ExtensionOptionsProvider = ExtensionOptions | (() => ExtensionOptions);

export function resolveOptions(options: ExtensionOptionsProvider): ExtensionOptions {
	return typeof options === "function" ? options() : options;
}

export function readOptions(): ExtensionOptions {
	const configuration = workspace.getConfiguration(EXT_NAME);
	const camelCase = configuration.get<CamelCaseValues>("camelCase", false);
	const createCssModuleTargetFolder = configuration.get<string>("createCssModule.targetFolder", "");
	const pathAlias = configuration.get<AliasFromUserOptions>("pathAlias", {});

	return {
		camelCase,
		createCssModuleTargetFolder,
		pathAlias
	};
}
