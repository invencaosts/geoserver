import { parseRedisUrl } from "./queue.module";

describe("parseRedisUrl", () => {
  it("preserva autenticação, banco e porta da URL", () => {
    expect(parseRedisUrl("redis://usuario:senha%20forte@redis.internal:6380/3")).toEqual({
      host: "redis.internal",
      port: 6380,
      username: "usuario",
      password: "senha forte",
      db: 3,
    });
  });

  it("configura TLS para rediss e aplica a porta padrão", () => {
    expect(parseRedisUrl("rediss://cache.example/0")).toEqual({
      host: "cache.example",
      port: 6379,
      tls: { servername: "cache.example" },
    });
  });

  it("rejeita protocolo e banco inválidos", () => {
    expect(() => parseRedisUrl("http://cache.example/0")).toThrow("protocolo");
    expect(() => parseRedisUrl("redis://cache.example/invalido")).toThrow("banco inválido");
  });
});

