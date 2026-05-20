import type { OllamaModel } from "../types/chat";

type Props = {
  models: OllamaModel[];
  value: string;
  onChange: (value: string) => void;
};

export function ModelSelector({ models, value, onChange }: Props) {
  return (
    <select className="model-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {models.length === 0 && <option value={value}>{value || "未读取到模型"}</option>}
      {models.map((model) => (
        <option key={model.name || model.model} value={model.name || model.model}>
          {model.name || model.model}
        </option>
      ))}
    </select>
  );
}
