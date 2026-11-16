import { keyHint } from "@earendil-works/pi-coding-agent";
import { getCapabilities, hyperlink } from "@earendil-works/pi-tui";
import type { NormalizedSearchResult } from "./types.ts";

interface RenderTheme {
	fg: (name: string, value: string) => string;
	bold: (value: string) => string;
	italic?: (value: string) => string;
	underline?: (value: string) => string;
}

/** Wrap styled text in an OSC 8 link when the terminal forwards hyperlinks. */
export function linkUrl(styledText: string, url: string): string {
	return getCapabilities().hyperlinks ? hyperlink(styledText, url) : styledText;
}

/** Render structured search results for the expanded TUI view. Not sent to the LLM. */
export function appendSearchResults(base: string, results: readonly NormalizedSearchResult[], theme: RenderTheme): string {
	const indent = "   ";
	for (const [index, result] of results.entries()) {
		base += "\n";
		const title = linkUrl(theme.bold(theme.fg("mdHeading", result.title)), result.url);
		base += `\n${theme.fg("dim", `${index + 1}.`)} ${title}`;
		const url = theme.fg("mdLink", result.url);
		base += `\n${indent}${linkUrl(theme.underline ? theme.underline(url) : url, result.url)}`;
		if (result.publishedAt) {
			const date = theme.fg("dim", result.publishedAt);
			base += `\n${indent}${theme.italic ? theme.italic(date) : date}`;
		}
		if (result.snippet) {
			for (const line of result.snippet.split("\n")) {
				base += `\n${indent}${theme.fg("toolOutput", line)}`;
			}
		}
	}
	return base;
}

export function getTextContent(content: Array<{ type: string; text?: string }> | undefined): string {
	if (!content) return "";
	return content
		.filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

export function appendExpandedPreview(
	base: string,
	text: string,
	theme: {
		fg: (name: string, value: string) => string;
	},
	options: { maxLines?: number; maxColumns?: number } = {},
): string {
	const maxLines = options.maxLines ?? 12;
	const maxColumns = options.maxColumns ?? 200;
	const lines = text.split("\n");
	for (const line of lines.slice(0, maxLines)) {
		base += `\n${theme.fg("dim", line.slice(0, maxColumns))}`;
	}
	if (lines.length > maxLines) {
		base += `\n${theme.fg("muted", "...")}`;
	}
	return base;
}

// Subset of Pi's ToolRenderContext. Hosts with earendil-works/pi#11630 pass keyHint; older hosts do not.
// `expanded` exists on every host context and keeps this assignable from older ToolRenderContext types.
export interface ExpandHintContext {
	expanded?: boolean;
	keyHint?: (keybinding: "app.tools.expand", description: string) => string;
}

export function appendExpandHint(base: string, expanded: boolean, context?: ExpandHintContext): string {
	if (expanded) return base;
	return `${base} ${context?.keyHint ? context.keyHint("app.tools.expand", "for details") : keyHint("app.tools.expand" as any, "for details")}`;
}
