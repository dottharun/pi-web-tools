import test from "node:test";
import assert from "node:assert/strict";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { getCapabilities, setCapabilities } from "@earendil-works/pi-tui";
import { parsePublicHttpUrl } from "../types.ts";
import { createWebSearchTool, formatSearchResults } from "../websearch.ts";

initTheme(undefined, false);

const renderTheme = {
	fg: (_name: string, value: string) => value,
	bold: (value: string) => value,
};

test("websearch renderResult prefers host key hints for collapsed results", () => {
	const tool = createWebSearchTool();
	const calls: Array<[string, string]> = [];
	const result = { content: [{ type: "text", text: "Search content" }] };

	const collapsed = tool.renderResult(result, { expanded: false, isPartial: false }, renderTheme, {
		keyHint(keybinding, description) {
			calls.push([keybinding, description]);
			return "HOST ctrl+o for details";
		},
	});
	assert.match(collapsed.render(200).join("\n"), /✓ 0 results HOST ctrl\+o for details/);
	assert.deepEqual(calls, [["app.tools.expand", "for details"]]);

	const fallback = tool.renderResult(result, { expanded: false, isPartial: false }, renderTheme);
	assert.match(fallback.render(200).join("\n"), /✓ 0 results/);

	const expanded = tool.renderResult(result, { expanded: true, isPartial: false }, renderTheme, {
		keyHint() {
			assert.fail("expanded results must not request a key hint");
		},
	});
	assert.match(expanded.render(200).join("\n"), /Search content/);
});

test("websearch expanded view renders structured results with OSC 8 links when supported", (t) => {
	const url = parsePublicHttpUrl("https://example.com/page");
	assert.equal(url._tag, "ok");
	const tool = createWebSearchTool();
	const result = {
		content: [{ type: "text", text: "LLM text" }],
		details: {
			query: "q",
			depth: "auto" as const,
			maxResults: 1,
			provider: "exa" as const,
			resultCount: 1,
			results: [{ title: "Example", url: url.value, publishedAt: "2026-01-02", snippet: "line one\nline two" }],
		},
	};
	const original = getCapabilities();
	t.after(() => setCapabilities(original));

	setCapabilities({ ...original, hyperlinks: true });
	const linked = tool.renderResult(result, { expanded: true, isPartial: false }, renderTheme).render(200).join("\n");
	assert.doesNotMatch(linked, /LLM text/);
	assert.match(linked, /1\. .*Example/);
	assert.match(linked, /\x1b\]8;;https:\/\/example\.com\/page/);
	assert.match(linked, /2026-01-02/);
	assert.match(linked, /line one[\s\S]*line two/);

	setCapabilities({ ...original, hyperlinks: false });
	const plain = tool.renderResult(result, { expanded: true, isPartial: false }, renderTheme).render(200).join("\n");
	assert.doesNotMatch(plain, /\x1b\]8;;/);
	assert.match(plain, /https:\/\/example\.com\/page/);
});

test("formatSearchResults renders deterministic URL-forward output", () => {
	const url = parsePublicHttpUrl("https://example.com/");
	assert.equal(url._tag, "ok");

	const output = formatSearchResults("example query", [
		{
			title: "Example Domain",
			url: url.value,
			snippet: "Documentation-safe example domain.",
		},
	]);
	assert.equal(
		output,
		[
			"Search results for: example query",
			"",
			"1. Example Domain",
			"   URL: https://example.com/",
			"   Snippet: Documentation-safe example domain.",
		].join("\n"),
	);
});
