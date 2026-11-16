import test from "node:test";
import assert from "node:assert/strict";
import { ok, type Result } from "../result.ts";
import { KEENABLE_APP_TITLE, KEENABLE_SNIPPET_MAX_LENGTH, KeenableSearchProvider } from "../providers/keenable.ts";
import type { HttpClientError, HttpJsonRequest, HttpTextClient, HttpTextResponse } from "../providers/exa.ts";
import { parsePublicHttpUrl, parseSearchQuery } from "../types.ts";

class RecordingHttpTextClient implements HttpTextClient {
	readonly requests: HttpJsonRequest[] = [];

	constructor(private readonly response: Result<HttpTextResponse, HttpClientError>) {}

	async postJson(request: HttpJsonRequest): Promise<Result<HttpTextResponse, HttpClientError>> {
		this.requests.push(request);
		return this.response;
	}
}

function jsonResponse(status: number, body: unknown): Result<HttpTextResponse, HttpClientError> {
	const bodyText = JSON.stringify(body);
	return ok({
		status,
		statusText: status === 200 ? "OK" : "Error",
		headers: new Headers({ "content-type": "application/json" }),
		bodyText,
		bytes: bodyText.length,
	});
}

function setup() {
	const endpoint = parsePublicHttpUrl("https://example.test/v1/search/public");
	const query = parseSearchQuery("keenable docs");
	assert.equal(endpoint._tag, "ok");
	assert.equal(query._tag, "ok");
	return { endpoint: endpoint.value, query: query.value };
}

test("KeenableSearchProvider posts the public search body and parses results", async () => {
	const { endpoint, query } = setup();
	const http = new RecordingHttpTextClient(jsonResponse(200, {
		query: "keenable docs",
		mode: "pro",
		results: [
			{
				title: "CLI",
				url: "https://docs.keenable.ai/cli",
				description: "",
				snippet: " Search and fetch work without an account. ",
				published_at: "2026-11-12T19:23:16Z",
				acquired_at: "2026-11-14T11:33:41Z",
			},
			{ title: "", url: "https://docs.keenable.ai/faq.md", description: "", snippet: "" },
			{ title: "bad", url: "ftp://example.com/" },
			{ title: "no url" },
		],
	}));

	const provider = new KeenableSearchProvider(endpoint, http);
	const result = await provider.search({ query, maxResults: 5, depth: "auto" });

	assert.equal(result._tag, "ok");
	assert.deepEqual(result.value, [
		{
			title: "CLI",
			url: "https://docs.keenable.ai/cli",
			snippet: "Search and fetch work without an account.",
			publishedAt: "2026-11-12T19:23:16Z",
		},
		{
			title: "https://docs.keenable.ai/faq.md",
			url: "https://docs.keenable.ai/faq.md",
			snippet: undefined,
			publishedAt: undefined,
		},
	]);
	assert.equal(http.requests[0]?.url, endpoint);
	assert.equal(http.requests[0]?.headers["x-keenable-title"], KEENABLE_APP_TITLE);
	assert.deepEqual(http.requests[0]?.body, {
		query,
		mode: "pro",
		max_results: 5,
		snippet_max_length: KEENABLE_SNIPPET_MAX_LENGTH,
	});
});

test("KeenableSearchProvider maps fast depth to realtime mode", async () => {
	const { endpoint, query } = setup();
	const http = new RecordingHttpTextClient(jsonResponse(200, { results: [] }));
	await new KeenableSearchProvider(endpoint, http).search({ query, maxResults: 3, depth: "fast" });
	assert.equal((http.requests[0]?.body as { mode: string }).mode, "realtime");
});

test("KeenableSearchProvider rejects non-2xx statuses and malformed payloads", async () => {
	const { endpoint, query } = setup();
	const rejected = await new KeenableSearchProvider(
		endpoint,
		new RecordingHttpTextClient(jsonResponse(429, { error: "Rate limited", message: "raw detail" })),
	).search({ query, maxResults: 3, depth: "auto" });
	assert.deepEqual(rejected, {
		_tag: "err",
		error: { _tag: "SearchProviderStatusRejected", provider: "keenable", status: 429 },
	});

	const invalid = await new KeenableSearchProvider(
		endpoint,
		new RecordingHttpTextClient(jsonResponse(200, { query: "x" })),
	).search({ query, maxResults: 3, depth: "auto" });
	assert.deepEqual(invalid, {
		_tag: "err",
		error: { _tag: "SearchProviderProtocolInvalid", provider: "keenable", reason: "Missing results array" },
	});
});
