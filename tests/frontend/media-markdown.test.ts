import assert from "node:assert/strict";
import test from "node:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { mediaMarkdown } from "../../src/lib/media-markdown";

test("media URLs escape Markdown delimiters, quotes and backslashes explicitly", () => {
  assert.equal(mediaMarkdown("/media/a (b).png", "Image"), "![Image](/media/a%20%28b%29.png)");
  assert.equal(mediaMarkdown("/media/a\"b'c\\d`e.png", "Image"), "![Image](/media/a%22b%27c%5Cd%60e.png)");
  assert.equal(mediaMarkdown("/media/<image>.png", "Image"), "![Image](/media/%3Cimage%3E.png)");
});

test("media labels escape brackets/backslashes and normalize line breaks", () => {
  assert.equal(mediaMarkdown("/media/image.png", "An [image]\\caption"), "![An \\[image\\]\\\\caption](/media/image.png)");
  assert.equal(mediaMarkdown("/media/image.png", "First\r\nsecond"), "![First second](/media/image.png)");
  assert.equal(mediaMarkdown("/media/image.png", "[x](javascript:alert(1))"), "![\\[x\\](javascript:alert(1))](/media/image.png)");
});

test("crafted media labels still parse into exactly one image with the intended URL", () => {
  const label = "x](https://attacker.example) ![second\\image";
  const snippet = mediaMarkdown("/media/a (b).png", label)!;
  const document = unified().use(remarkParse).parse(snippet);
  assert.equal(document.children.length, 1);
  const paragraph = document.children[0];
  assert.equal(paragraph.type, "paragraph");
  assert.ok("children" in paragraph);
  assert.equal(paragraph.children.length, 1);
  const image = paragraph.children[0];
  assert.equal(image.type, "image");
  assert.ok("url" in image && "alt" in image);
  assert.equal(image.url, "/media/a%20%28b%29.png");
  assert.equal(image.alt, label);
});

test("ordinary media URLs preserve queries and existing percent encoding", () => {
  assert.equal(mediaMarkdown("https://example.com/image%20one.png?size=2&version=3#image", "Image"), "![Image](https://example.com/image%20one.png?size=2&version=3#image)");
  assert.equal(mediaMarkdown("  /media/image.png  ", "Image"), "![Image](/media/image.png)");
  assert.equal(mediaMarkdown("../media/image.png", "Image"), "![Image](../media/image.png)");
});

test("images and file links use distinct Markdown syntax", () => {
  assert.equal(mediaMarkdown("https://example.com/report.pdf", "Report", false), "[Report](https://example.com/report.pdf)");
  assert.equal(mediaMarkdown("/media/image.png", ""), "![](/media/image.png)");
});

test("unsafe URL schemes and control characters are rejected", () => {
  for (const url of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "vbscript:msgbox(1)",
    "data:image/svg+xml,anything", "file:///tmp/image.png", "blob:https://example.com/id",
    "https://example.com/\nimage.png", "https://example.com/image.png\n",
    "\thttps://example.com/image.png", "/media/\u0000image.png", "/media/\u007fimage.png",
    "http://[invalid", "", "   "
  ]) {
    assert.equal(mediaMarkdown(url, "Bad"), null, url);
  }
});
