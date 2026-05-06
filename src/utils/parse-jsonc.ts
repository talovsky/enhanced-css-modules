export function parseJsonc(text: string): unknown {
	return JSON.parse(stripJsonc(text));
}

function stripJsonc(text: string): string {
	const n = text.length;
	let out = "";
	let i = 0;
	while (i < n) {
		const c = text[i];
		if (c === '"') {
			const start = i++;
			while (i < n) {
				if (text[i] === "\\") {
					i += 2;
					continue;
				}
				if (text[i] === '"') {
					i++;
					break;
				}
				i++;
			}
			out += text.slice(start, i);
			continue;
		}
		if (c === "/" && text[i + 1] === "/") {
			i += 2;
			while (i < n && text[i] !== "\n") i++;
			continue;
		}
		if (c === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < n - 1 && !(text[i] === "*" && text[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		if (c === ",") {
			let j = i + 1;
			while (j < n) {
				const cj = text[j];
				if (cj === " " || cj === "\t" || cj === "\n" || cj === "\r") {
					j++;
					continue;
				}
				if (cj === "/" && text[j + 1] === "/") {
					j += 2;
					while (j < n && text[j] !== "\n") j++;
					continue;
				}
				if (cj === "/" && text[j + 1] === "*") {
					j += 2;
					while (j < n - 1 && !(text[j] === "*" && text[j + 1] === "/")) j++;
					j += 2;
					continue;
				}
				break;
			}
			if (j < n && (text[j] === "}" || text[j] === "]")) {
				i++;
				continue;
			}
		}
		out += c;
		i++;
	}
	return out;
}
