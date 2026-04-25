import * as fs from "node:fs/promises";

export class Position {
	constructor(
		public line: number,
		public character: number
	) {}
}

export class Range {
	constructor(
		public start: Position,
		public end: Position
	) {}
}

export class Uri {
	constructor(public fsPath: string) {}

	static file(filePath: string): Uri {
		return new Uri(filePath);
	}
}

export class Location {
	range: Range;

	constructor(
		public uri: Uri,
		range: Range | Position
	) {
		this.range = range instanceof Position ? new Range(range, range) : range;
	}
}

export enum CompletionItemKind {
	Variable = 5
}

export class CompletionItem {
	detail?: string;
	documentation?: string;
	insertText?: string;
	additionalTextEdits?: TextEdit[];

	constructor(
		public label: string,
		public kind?: CompletionItemKind
	) {}
}

export class TextEdit {
	constructor(
		public range: Range,
		public newText: string
	) {}
}

export class WorkspaceEdit {
	private readonly changes = new Map<string, { uri: Uri; edits: TextEdit[] }>();

	replace(uri: Uri, range: Range, newText: string): void {
		const key = uri.fsPath;
		const entry = this.changes.get(key) || { uri, edits: [] };
		entry.edits.push(new TextEdit(range, newText));
		this.changes.set(key, entry);
	}

	entries(): [Uri, TextEdit[]][] {
		return Array.from(this.changes.values()).map(entry => [entry.uri, entry.edits]);
	}
}

export class RelativePattern {
	constructor(
		public base: unknown,
		public pattern: string
	) {}
}

class TextDocument {
	readonly lineStarts: number[];

	constructor(
		public uri: Uri,
		private readonly text: string
	) {
		this.lineStarts = getLineStarts(text);
	}

	getText(range?: Range): string {
		if (!range) {
			return this.text;
		}

		return this.text.slice(this.offsetAt(range.start), this.offsetAt(range.end));
	}

	lineAt(position: Position): { text: string; range: Range } {
		const lineStart = this.lineStarts[position.line] ?? this.text.length;
		const nextLineStart = this.lineStarts[position.line + 1] ?? this.text.length;
		const lineEnd =
			nextLineStart > lineStart && this.text[nextLineStart - 1] === "\n" ? nextLineStart - 1 : nextLineStart;
		const end = this.text[lineEnd - 1] === "\r" ? lineEnd - 1 : lineEnd;

		return {
			text: this.text.slice(lineStart, end),
			range: new Range(new Position(position.line, 0), new Position(position.line, end - lineStart))
		};
	}

	offsetAt(position: Position): number {
		return (this.lineStarts[position.line] ?? this.text.length) + position.character;
	}

	positionAt(offset: number): Position {
		const clampedOffset = Math.max(0, Math.min(offset, this.text.length));
		let line = 0;

		for (let i = 0; i < this.lineStarts.length; i++) {
			if (this.lineStarts[i] > clampedOffset) {
				break;
			}
			line = i;
		}

		return new Position(line, clampedOffset - this.lineStarts[line]);
	}
}

export const workspace = {
	workspaceFolders: [],
	getConfiguration() {
		return {
			get<T>(_key: string, fallback: T): T {
				return fallback;
			}
		};
	},
	getWorkspaceFolder() {
		return undefined;
	},
	async openTextDocument(file: Uri | string): Promise<TextDocument> {
		const uri = typeof file === "string" ? Uri.file(file) : file;
		const text = await fs.readFile(uri.fsPath, { encoding: "utf8" });
		return new TextDocument(uri, text);
	},
	async findFiles(): Promise<Uri[]> {
		return [];
	},
	createFileSystemWatcher() {
		return {
			onDidChange() {},
			dispose() {}
		};
	}
};

function getLineStarts(text: string): number[] {
	const starts = [0];

	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") {
			starts.push(i + 1);
		}
	}

	return starts;
}
