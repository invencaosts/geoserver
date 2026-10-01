import { safeCsvCell } from "./reports.service";

describe("safeCsvCell", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@comando", "  =HYPERLINK(\"x\")"])(
    "neutraliza fórmula de planilha em %s",
    (value) => {
      expect(safeCsvCell(value)).toBe(`'${value}`);
    },
  );

  it("preserva texto comum", () => {
    expect(safeCsvCell("Caso fictício")).toBe("Caso fictício");
  });
});
