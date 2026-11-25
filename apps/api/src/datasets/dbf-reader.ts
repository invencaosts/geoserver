/** DBF rows stay in file order, including tombstones, to preserve SHP/DBF pairing. */
export interface DbfRow {
  deleted: boolean;
  properties: Record<string, unknown>;
}

function decoderFor(buffer: Buffer, declaredEncoding?: string) {
  const declared = declaredEncoding?.replace(/^\uFEFF/, "").trim();
  const encoding = declared === "65001" ? "utf-8" : declared === "1252" ? "windows-1252" : declared;
  if (encoding) {
    try {
      return new TextDecoder(encoding, { fatal: true });
    } catch {
      throw new Error(`Codificação DBF não suportada: ${declared}`);
    }
  }
  // UTF-8 sem CPG é comum. Só usar Latin-1 quando os bytes não forem UTF-8 válido.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return new TextDecoder("utf-8", { fatal: true });
  } catch {
    return new TextDecoder("windows-1252", { fatal: true });
  }
}

function parseValue(text: string, type: string): unknown {
  if (!text) return type === "C" || type === "M" ? "" : null;
  if (["N", "F"].includes(type)) {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  if (type === "L") {
    if (/^[yt]$/i.test(text)) return true;
    if (/^[nf]$/i.test(text)) return false;
    return null;
  }
  if (type === "D") {
    if (!/^\d{8}$/.test(text)) return null;
    const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    const date = new Date(`${iso}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  }
  return text;
}

export function readDbfRows(buffer: Buffer, declaredEncoding?: string): DbfRow[] {
  if (buffer.length < 33) throw new Error("DBF incompleto");
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  if (
    headerLength < 33 ||
    recordLength < 1 ||
    headerLength + count * recordLength > buffer.length
  ) {
    throw new Error("DBF contém tamanho ou quantidade de registros inválidos");
  }
  const decoder = decoderFor(buffer.subarray(headerLength), declaredEncoding);
  const fields: { name: string; type: string; length: number }[] = [];
  for (let offset = 32; offset < headerLength && buffer[offset] !== 0x0d; offset += 32) {
    if (offset + 32 > headerLength) throw new Error("Cabeçalho DBF incompleto");
    fields.push({
      name: decoder
        .decode(buffer.subarray(offset, offset + 11))
        .replace(/\0.*$/, "")
        .trim(),
      type: String.fromCharCode(buffer[offset + 11]),
      length: buffer[offset + 16],
    });
  }
  for (const field of fields) {
    if (!["C", "N", "F", "D", "L", "M"].includes(field.type)) {
      throw new Error(
        `Tipo de campo DBF não suportado (${field.type}, ${field.name}); exporte a coluna para texto, número, data ou lógico antes de importar`,
      );
    }
  }
  if (fields.reduce((sum, field) => sum + field.length, 1) !== recordLength) {
    throw new Error("Comprimento dos campos DBF não corresponde ao registro");
  }
  const rows: DbfRow[] = [];
  for (let index = 0; index < count; index++) {
    let offset = headerLength + index * recordLength;
    const deleted = buffer[offset++] === 0x2a;
    const properties = Object.create(null) as Record<string, unknown>;
    for (const field of fields) {
      const text = decoder
        .decode(buffer.subarray(offset, offset + field.length))
        .replace(/\0/g, "")
        .trim();
      properties[field.name] = parseValue(text, field.type);
      offset += field.length;
    }
    rows.push({ deleted, properties });
  }
  return rows;
}
