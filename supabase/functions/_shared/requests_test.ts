import { assertEquals } from "@std/assert";
import { parseRequest } from "./requests.ts";

Deno.test("splits title and details on a spaced dash or colon", () => {
  assertEquals(parseRequest("Sarah – surgery on Friday"), { title: "Sarah", details: "surgery on Friday" });
  assertEquals(parseRequest("Sarah - surgery"), { title: "Sarah", details: "surgery" });
  assertEquals(parseRequest("Sarah — surgery"), { title: "Sarah", details: "surgery" });
  assertEquals(parseRequest("Dad: new job – first week"), { title: "Dad", details: "new job – first week" });
});

Deno.test("keeps hyphenated names and plain text whole", () => {
  assertEquals(parseRequest("Mary-Anne"), { title: "Mary-Anne", details: null });
  assertEquals(parseRequest("  my   job interview "), { title: "my job interview", details: null });
});

Deno.test("handles empty, dangling and oversized input", () => {
  assertEquals(parseRequest("   "), "empty");
  assertEquals(parseRequest("Sarah – "), { title: "Sarah", details: null });
  assertEquals(parseRequest("– surgery"), { title: "surgery", details: null });
  assertEquals(parseRequest("x".repeat(201)), "too_long");
  assertEquals(parseRequest(`Sarah – ${"x".repeat(501)}`), "too_long");
});
