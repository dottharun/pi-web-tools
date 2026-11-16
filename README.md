# Pi Web Tools

A [Pi](https://pi.dev) package that adds tools for fetching and searching the public web.

- `webfetch` fetches one public URL as Markdown, text, raw HTML, or an inline raster image.
- `websearch` searches the public web through an Exa or Parallel MCP-compatible endpoint, or Keenable's public search API.

## Install

Configure an Exa MCP-compatible endpoint, then install globally from GitHub:

```bash
export PI_WEB_TOOLS_EXA_ENDPOINT="https://your-exa-endpoint.example/mcp"
pi install git:github.com/dmmulroy/pi-web-tools
```

Or select Parallel:

```bash
export PI_WEB_TOOLS_SEARCH_PROVIDER="parallel"
export PI_WEB_TOOLS_PARALLEL_ENDPOINT="https://your-parallel-endpoint.example/mcp"
```

Or select Keenable, which needs no key or endpoint:

```bash
export PI_WEB_TOOLS_SEARCH_PROVIDER="keenable"
```

Try it for one Pi invocation without installing:

```bash
pi -e git:github.com/dmmulroy/pi-web-tools
```

Pi packages execute with your full system permissions. Review package source before installation.

## Tools

### `webfetch`

Parameters:

- `url` — required HTTP or HTTPS URL
- `format` — optional: `markdown`, `text`, or `html`
- `timeout` — optional timeout in seconds, clamped to `1..120`

Defaults and behavior:

- returns Markdown by default
- blocks private and local hosts and IP addresses
- follows at most five redirects
- rejects URL credentials and unsupported binary content
- returns PNG, JPEG, GIF, and WebP images inline
- limits responses to 5 MB
- retries Cloudflare challenge responses with a browser-like fallback user agent

### `websearch`

Parameters:

- `query` — required search query
- `maxResults` — optional result count, clamped to `1..20`
- `depth` — optional: `auto`, `fast`, or `deep`; `deep` is accepted as a compatibility alias for `fast`

Defaults and behavior:

- returns up to eight results
- defaults to Exa and optionally supports Parallel or Keenable
- limits provider responses to 1 MB
- truncates large tool output and saves the complete output to a temporary file

## Configuration

`websearch` defaults to Exa and requires `PI_WEB_TOOLS_EXA_ENDPOINT` to contain a public HTTP or HTTPS URL for an Exa MCP-compatible endpoint:

```bash
export PI_WEB_TOOLS_EXA_ENDPOINT="https://your-exa-endpoint.example/mcp"
```

To use Parallel instead:

```bash
export PI_WEB_TOOLS_SEARCH_PROVIDER="parallel"
export PI_WEB_TOOLS_PARALLEL_ENDPOINT="https://your-parallel-endpoint.example/mcp"
```

To use Keenable instead:

```bash
export PI_WEB_TOOLS_SEARCH_PROVIDER="keenable"
```

Keenable calls the unauthenticated `https://api.keenable.ai/v1/search/public` endpoint by default, which is rate limited per IP. Set `PI_WEB_TOOLS_KEENABLE_ENDPOINT` to override it. `depth: "fast"` maps to Keenable's `realtime` mode; `auto` and `deep` use `pro`. Snippets are capped at 300 characters per result.

`webfetch` does not require these variables. Per-call arguments can override `webfetch.format`, `webfetch.timeout`, `websearch.maxResults`, and `websearch.depth`.

## Development

Requires Node.js 22.19 or newer.

```bash
npm install
npm run check
```

## License

[MIT](./LICENSE)
