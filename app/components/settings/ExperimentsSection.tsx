/**
 * ExperimentsSection — экспериментальные флаги (localStorage).
 */
import { useEffect, useState } from "react";
import {
  readAgentPolishEnabled,
  writeAgentPolishEnabled,
} from "~/lib/utils/agentPolishPreference";

export function ExperimentsSection() {
  const [agentPolish, setAgentPolish] = useState(false);

  useEffect(() => {
    setAgentPolish(readAgentPolishEnabled());
  }, []);

  const toggleAgentPolish = () => {
    const next = !agentPolish;
    setAgentPolish(next);
    writeAgentPolishEnabled(next);
  };

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-3 text-[#71717A]/80">
        Эксперименты
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={agentPolish}
            onChange={toggleAgentPolish}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 accent-white"
          />
          <span className="flex-1">
            <span className="block text-[13px] font-medium text-white group-hover:text-white/90">
              Agent polish
            </span>
            <span className="block text-[12px] text-[#71717A] mt-1 leading-relaxed">
              Модель сначала объясняет правки текстом (как в LM Studio), затем отдаёт
              полный HTML. Основной polish-пайплайн не меняется — включается только для
              правок существующего сайта.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
