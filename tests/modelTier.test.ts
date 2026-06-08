import { describe, expect, it } from "vitest";
import {
  classifyModel,
  parseModelSizeB,
  parseQuantBits,
  applyRuntimeDowngrade,
  tierProfile,
} from "~/lib/llm/modelTier";

describe("parseModelSizeB", () => {
  it("извлекает размер из типичных имён", () => {
    expect(parseModelSizeB("qwen2.5-coder-7b-instruct")).toBe(7);
    expect(parseModelSizeB("Qwen2.5-Coder-32B-Instruct-Q4_K_M")).toBe(32);
    expect(parseModelSizeB("llama-3.3-70b-instruct")).toBe(70);
    expect(parseModelSizeB("gemma-2-9b-it-Q6_K")).toBe(9);
    expect(parseModelSizeB("mistral-small-24b-instruct-2501")).toBe(24);
    expect(parseModelSizeB("qwen2.5-1.5b-instruct")).toBe(1.5);
  });

  it("не путает квант/версию с размером", () => {
    expect(parseModelSizeB("phi-4")).toBeUndefined();
    expect(parseModelSizeB("model-4bit-quant")).toBeUndefined();
    expect(parseModelSizeB("some-custom-merge")).toBeUndefined();
  });

  it("работает на полном GGUF-пути", () => {
    expect(
      parseModelSizeB(
        "lmstudio-community/Qwen2.5-Coder-32B-Instruct-GGUF/Qwen2.5-Coder-32B-Instruct-Q4_K_M.gguf",
      ),
    ).toBe(32);
  });
});

describe("parseQuantBits", () => {
  it("извлекает битность кванта", () => {
    expect(parseQuantBits("qwen-32b-q4_k_m")).toBe(4);
    expect(parseQuantBits("gemma-9b-Q6_K")).toBe(6);
    expect(parseQuantBits("model-q3_k_m")).toBe(3);
    expect(parseQuantBits("model-iq2_xs")).toBe(2);
    expect(parseQuantBits("model-q8_0")).toBe(8);
  });

  it("undefined для fp16/без кванта", () => {
    expect(parseQuantBits("qwen-32b-instruct")).toBeUndefined();
    expect(parseQuantBits("model-fp16")).toBeUndefined();
  });
});

describe("classifyModel — базовая классификация по размеру", () => {
  it("7-9B → S", () => {
    expect(classifyModel({ model: "qwen2.5-coder-7b-instruct" })).toBe("S");
    expect(classifyModel({ model: "llama-3.1-8b-instruct" })).toBe("S");
    expect(classifyModel({ model: "gemma-2-9b-it" })).toBe("S");
  });

  it("12-24B → M", () => {
    expect(classifyModel({ model: "qwen2.5-coder-14b-instruct" })).toBe("M");
    expect(classifyModel({ model: "mistral-small-24b-instruct" })).toBe("M");
  });

  it("30-70B → L", () => {
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct" })).toBe("L");
    expect(classifyModel({ model: "llama-3.3-70b-instruct" })).toBe("L");
  });

  it("неизвестная модель → S (безопасный дефолт)", () => {
    expect(classifyModel({ model: "some-custom-merge" })).toBe("S");
    expect(classifyModel({ model: "" })).toBe("S");
  });
});

describe("classifyModel — оверрайды для обманчивых имён", () => {
  it("Mixtral 8x7B — MoE, не S", () => {
    expect(classifyModel({ model: "mixtral-8x7b-instruct" })).toBe("M");
    expect(classifyModel({ model: "mixtral-8x22b-instruct" })).toBe("L");
  });

  it("phi-4 — 14B без «14b» в имени", () => {
    expect(classifyModel({ model: "phi-4" })).toBe("M");
    expect(classifyModel({ model: "phi-3.5-mini" })).toBe("S");
  });
});

describe("classifyModel — модификаторы кванта и контекста", () => {
  it("низкий квант Q2/Q3 понижает на ступень", () => {
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct-q3_k_m" })).toBe("M");
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct-iq2_xs" })).toBe("M");
  });

  it("квант Q4+ — норма, класс не меняется", () => {
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct-q4_k_m" })).toBe("L");
  });

  it("маленькое окно контекста понижает на ступень", () => {
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct", contextWindow: 4096 })).toBe("M");
    expect(classifyModel({ model: "qwen2.5-coder-32b-instruct", contextWindow: 32768 })).toBe("L");
  });
});

describe("applyRuntimeDowngrade — динамическая деградация по факту", () => {
  it("два+ обрыва по длине → понижение", () => {
    expect(applyRuntimeDowngrade("L", { lengthTruncations: 2 })).toBe("M");
    expect(applyRuntimeDowngrade("M", { lengthTruncations: 3 })).toBe("S");
  });

  it("битый вывод → понижение", () => {
    expect(applyRuntimeDowngrade("L", { lastOutputInvalid: true })).toBe("M");
  });

  it("одиночный обрыв или чистый вывод — без понижения", () => {
    expect(applyRuntimeDowngrade("L", { lengthTruncations: 1 })).toBe("L");
    expect(applyRuntimeDowngrade("L", {})).toBe("L");
  });

  it("S не падает ниже S", () => {
    expect(applyRuntimeDowngrade("S", { lastOutputInvalid: true })).toBe("S");
  });

  it("classifyModel учитывает stats когда переданы", () => {
    expect(
      classifyModel({ model: "qwen2.5-coder-32b-instruct" }, { lengthTruncations: 2 }),
    ).toBe("M");
  });
});

describe("tierProfile — профиль поведения", () => {
  it("L → artifact, большой бюджет, лёгкая обвязка", () => {
    const p = tierProfile("L");
    expect(p.approach).toBe("artifact");
    expect(p.codeMaxTokens).toBe(16_000);
    expect(p.heavyHarness).toBe(false);
  });

  it("S → coder, скромный бюджет, тяжёлая обвязка", () => {
    const p = tierProfile("S");
    expect(p.approach).toBe("coder");
    expect(p.codeMaxTokens).toBe(8_000);
    expect(p.heavyHarness).toBe(true);
  });

  it("M → coder, расширенный бюджет", () => {
    expect(tierProfile("M").codeMaxTokens).toBe(12_000);
    expect(tierProfile("M").heavyHarness).toBe(true);
  });
});
