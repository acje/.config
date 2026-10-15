const LARGE_PAYLOAD_BYTES = 800_000;

const OVERFLOW_BODY_PATTERNS = [
  /context[_ ]length[_ ]exceeded/i,
  /request[_ ]too[_ ]large/i,
  /exceeds?.*context/i,
  /context.*window/i,
  /too many tokens/i,
  /payload.*too large/i,
  /max.*(?:context|input|prompt).*length/i,
  /reduce.*length/i,
  /overflow/i,
];

function hasDataLine(text) {
  return text.split(/\r\n|\r|\n/).some((line) => line.startsWith("data:"));
}

function isOverflowBody(text) {
  return OVERFLOW_BODY_PATTERNS.some((pattern) => pattern.test(String(text)));
}

function requestByteLength(init) {
  const body = init?.body;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof Uint8Array) return body.byteLength;
  if (body && typeof body === "object") {
    if (typeof body.byteLength === "number") return body.byteLength;
    if (body instanceof Blob && typeof body.size === "number") return body.size;
  }
  return 0;
}

function contextOverflowResponse() {
  return new Response(
    JSON.stringify({
      error: {
        code: "context_length_exceeded",
        message: "Input exceeds the context window (request_too_large). Reduce the length of the messages.",
      },
    }),
    { status: 413, headers: { "content-type": "application/json" } },
  );
}

function upstreamEmptyResponse() {
  return new Response(
    JSON.stringify({
      error: {
        code: "upstream_empty_stream",
        message: "The upstream provider returned an empty HTTP 200 stream without any data.",
      },
    }),
    { status: 502, headers: { "content-type": "application/json" } },
  );
}

function isStreamingChatCompletion(input, init) {
  const method = String(init?.method || (input instanceof Request ? input.method : "") || "GET").toUpperCase();
  if (method !== "POST") return false;

  const raw =
    input instanceof URL
      ? input.href
      : input instanceof Request
        ? input.url
        : typeof input === "string"
          ? input
          : input?.url;
  if (typeof raw !== "string") return false;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!url.pathname.endsWith("/chat/completions")) return false;

  const body = init?.body;
  if (typeof body !== "string") return false;
  try {
    return JSON.parse(body)?.stream === true;
  } catch {
    return false;
  }
}

function concatThenContinue(buffered, reader) {
  let offset = 0;
  return new ReadableStream({
    async pull(controller) {
      if (offset < buffered.length) {
        controller.enqueue(buffered[offset]);
        offset += 1;
        return;
      }
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value) controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {});
    },
  });
}

async function ensureSseHasData(res, requestSize) {
  if (!res.body) {
    return requestSize >= LARGE_PAYLOAD_BYTES ? contextOverflowResponse() : upstreamEmptyResponse();
  }
  const reader = res.body.getReader();
  const buffered = [];
  const decoder = new TextDecoder();
  let scanned = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      buffered.push(value);
      scanned += decoder.decode(value, { stream: true });
      if (hasDataLine(scanned)) {
        return new Response(concatThenContinue(buffered, reader), {
          status: 200,
          headers: res.headers,
        });
      }
    }
  }
  return requestSize >= LARGE_PAYLOAD_BYTES ? contextOverflowResponse() : upstreamEmptyResponse();
}

async function guardedFetch(input, init) {
  if (!isStreamingChatCompletion(input, init)) {
    return fetch(input, init);
  }

  const res = await fetch(input, init);
  if (res.status !== 200) {
    return res;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const body = await res.text();
    if (isOverflowBody(body) || requestByteLength(init) >= LARGE_PAYLOAD_BYTES) {
      return contextOverflowResponse();
    }
    return upstreamEmptyResponse();
  }

  return ensureSseHasData(res, requestByteLength(init));
}

export default async function dramallamaGuardPlugin() {
  return {
    auth: {
      provider: "dramallama",
      async loader(getAuth) {
        try {
          await getAuth();
        } catch {
          // an auth lookup failure must never disable the streaming guard
        }
        return { fetch: guardedFetch };
      },
      methods: [{ type: "api", label: "API key" }],
    },
  };
}
