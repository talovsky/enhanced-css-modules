import type { ExtensionOptions } from "../options";

export function readOptions(overrides: Partial<ExtensionOptions> = {}): ExtensionOptions {
	return {
		createCssModuleTargetFolder: "",
		debugPerformance: false,
		pathAlias: {},
		...overrides
	};
}
