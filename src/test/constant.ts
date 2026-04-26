import path from "node:path";

export const ROOT_PATH = process.env.EXTENSION_ROOT || process.cwd();
export const FIXTURES_PATH = path.join(ROOT_PATH, "src", "test", "fixtures");

export const SAMPLE_REACT_FILE = path.join(FIXTURES_PATH, "sample-react.tsx");
export const SAMPLE_JS_FILE = path.join(FIXTURES_PATH, "sample.js");
export const SAMPLE_TSX_FILE = path.join(FIXTURES_PATH, "sample.tsx");
export const SAMPLE_TS_FILE = path.join(FIXTURES_PATH, "sample.ts");
export const SAMPLE_ASTRO_FILE = path.join(FIXTURES_PATH, "sample.astro");
export const STYLUS_TSX_FILE = path.join(FIXTURES_PATH, "stylus.tsx");
export const JUMP_PRECISE_DEF_FILE = path.join(FIXTURES_PATH, "jumpDef.tsx");
export const SPREAD_SYNTAX_FILE = path.join(FIXTURES_PATH, "spread-syntax", "index.ts");
