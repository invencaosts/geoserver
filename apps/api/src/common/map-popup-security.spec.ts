import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("popup de casos no mapa", () => {
  it("não injeta propriedades do caso como HTML", () => {
    const mapPage = readFileSync(
      resolve(__dirname, "../../../web/src/app/(app)/mapa/page.tsx"),
      "utf8",
    );

    expect(mapPage).not.toContain(".setHTML(");
    expect(mapPage).toContain(".setDOMContent(content)");
    expect(mapPage).toContain("title.textContent = nome");
    expect(mapPage).toContain("typeLine.textContent =");
    expect(mapPage).toContain("statusLine.textContent =");
  });
});
