import { err, ok, type Result } from "../result.ts";
import { parsePublicHttpUrl, type PublicHttpUrl, type SearchDepth } from "../types.ts";
import type { NormalizedSearchResult, SearchProvider, SearchProviderError, SearchProviderRequest } from "./types.ts";
import {
	MAX_SEARCH_RESPONSE_BYTES,
	type HttpClientError,
	type HttpTextClient,
} from "./exa.ts";

export const KEENABLE_PUBLIC_SEARCH_ENDPOINT = "https://api.keenable.ai/v1/search/public";
export const KEENABLE_APP_TITLE = "pi-web-tools";
/** Keenable snippets can run to several thousand characters; ~300 chars keeps 8 results near 1k tokens. */
export const KEENABLE_SNIPPET_MAX_LENGTH = 300;

type KeenableMode = "pro" | "realtime";

interface KeenableSearchResultDto {
	readonly url: string;
	readonly title?: string | null;
	readonly snippet?: string | null;
	readonly published_at?: string | null;
}

/** Search Keenable through its unauthenticated public REST endpoint. */
export class KeenableSearchProvider implements SearchProvider {
	readonly name = "keenable" as const;

	constructor(
		private readonly endpoint: PublicHttpUrl,
		private readonly http: HttpTextClient,
	) {}

	async search(
		input: SearchProviderRequest,
		options: { readonly signal?: AbortSignal } = {},
	): Promise<Result<readonly NormalizedSearchResult[], SearchProviderError>> {
		const response = await this.http.postJson(
			{
				url: this.endpoint,
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					"x-keenable-title": KEENABLE_APP_TITLE,
				},
				body: {
					query: input.query,
					mode: toKeenableMode(input.depth),
					max_results: input.maxResults,
					snippet_max_length: KEENABLE_SNIPPET_MAX_LENGTH,
				},
				maxResponseBytes: MAX_SEARCH_RESPONSE_BYTES,
			},
			{ signal: options.signal },
		);

		if (response._tag === "err") return err(mapHttpClientError(response.error));
		if (response.value.status < 200 || response.value.status >= 300) {
			return err({ _tag: "SearchProviderStatusRejected", provider: this.name, status: response.value.status });
		}

		const parsed = parseKeenableResponse(response.value.bodyText);
		if (parsed._tag === "err") {
			return err({ _tag: "SearchProviderProtocolInvalid", provider: this.name, reason: parsed.error });
		}
		return ok(parsed.value.slice(0, input.maxResults));
	}
}

function toKeenableMode(depth: SearchDepth): KeenableMode {
	return depth === "fast" ? "realtime" : "pro";
}

function parseKeenableResponse(body: string): Result<readonly NormalizedSearchResult[], string> {
	let payload: unknown;
	try {
		payload = JSON.parse(body);
	} catch {
		return err("Invalid JSON payload");
	}
	if (!isRecord(payload)) return err("Expected an object payload");
	if (!Array.isArray(payload["results"])) return err("Missing results array");

	const results: NormalizedSearchResult[] = [];
	for (const item of payload["results"]) {
		if (!isKeenableResult(item)) continue;
		const url = parsePublicHttpUrl(item.url);
		if (url._tag === "err") continue;
		results.push({
			title: item.title?.trim() || url.value,
			url: url.value,
			snippet: item.snippet?.trim() || undefined,
			publishedAt: item.published_at?.trim() || undefined,
		});
	}
	return ok(results);
}

function mapHttpClientError(error: HttpClientError): SearchProviderError {
	switch (error._tag) {
		case "HttpRequestFailed":
			return { _tag: "SearchProviderUnavailable", provider: "keenable", cause: error.cause };
		case "HttpResponseTooLarge":
			return { _tag: "SearchProviderResponseTooLarge", provider: "keenable", maxBytes: error.maxBytes };
		case "HttpCancelled":
			return { _tag: "SearchProviderCancelled", provider: "keenable", cause: error.cause };
	}
}

function isKeenableResult(value: unknown): value is KeenableSearchResultDto {
	return isRecord(value)
		&& typeof value["url"] === "string"
		&& isOptionalString(value["title"])
		&& isOptionalString(value["snippet"])
		&& isOptionalString(value["published_at"]);
}

function isOptionalString(value: unknown): boolean {
	return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
