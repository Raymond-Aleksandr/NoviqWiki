import { describe, expect, it } from "vitest";
import { urlWithinRequestHost } from "@/lib/request-url";

describe("request URL helpers", () => {
  it("uses the incoming Host header instead of a bind-address request URL", () => {
    const request = new Request("http://0.0.0.0:3100/history/page/compare?from=a", {
      headers: {
        host: "10.0.0.180:3100"
      }
    });

    expect(urlWithinRequestHost(request, "/diff/a/b").toString()).toBe(
      "http://10.0.0.180:3100/diff/a/b"
    );
  });

  it("honors reverse-proxy host and protocol headers", () => {
    const request = new Request("http://0.0.0.0:3100/random", {
      headers: {
        host: "internal:3100",
        "x-forwarded-host": "wiki.example.test",
        "x-forwarded-proto": "https"
      }
    });

    expect(urlWithinRequestHost(request, "/page/example").toString()).toBe(
      "https://wiki.example.test/page/example"
    );
  });
});
