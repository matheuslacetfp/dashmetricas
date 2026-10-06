"use client";

import { useState } from "react";
import { createCutBatch } from "@/app/actions";

type EntryMode = "list" | "sequence";

export function CutBatchForm({
  initialPrefix = "corte-",
  initialStart = 1,
  initialPadding = 3,
}: {
  initialPrefix?: string;
  initialStart?: number;
  initialPadding?: number;
}) {
  const [mode, setMode] = useState<EntryMode>("sequence");
  const [start, setStart] = useState(String(initialStart));
  const [quantity, setQuantity] = useState("100");
  const [prefix, setPrefix] = useState(initialPrefix);
  const [padding, setPadding] = useState(String(initialPadding));

  const firstNumber = Number(start);
  const count = Number(quantity);
  const width = Number(padding);
  const canPreview =
    Number.isSafeInteger(firstNumber) &&
    firstNumber >= 0 &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    count <= 500 &&
    Number.isSafeInteger(width) &&
    width >= 1 &&
    width <= 12 &&
    Number.isSafeInteger(firstNumber + count - 1);

  const preview = canPreview
    ? Array.from({ length: Math.min(count, 3) }, (_, index) => {
        return `${prefix}${String(firstNumber + index).padStart(width, "0")}`;
      })
    : [];
  const finalPreview =
    canPreview && count > 3
      ? `${prefix}${String(firstNumber + count - 1).padStart(width, "0")}`
      : undefined;

  return (
    <form action={createCutBatch} className="space-y-4">
      <input name="mode" type="hidden" value={mode} />

      <div
        aria-label="Como informar os IDs"
        className="mode-switch"
        role="group"
      >
        <button
          aria-pressed={mode === "sequence"}
          onClick={() => setMode("sequence")}
          type="button"
        >
          Gerar sequência
        </button>
        <button
          aria-pressed={mode === "list"}
          onClick={() => setMode("list")}
          type="button"
        >
          Colar lista
        </button>
      </div>

      {mode === "sequence" ? (
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Prefixo
            <input
              className="field mt-1.5"
              maxLength={90}
              name="prefix"
              onChange={(event) => setPrefix(event.target.value)}
              value={prefix}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Número inicial
              <input
                className="field mt-1.5"
                min="0"
                name="start"
                onChange={(event) => setStart(event.target.value)}
                required
                type="number"
                value={start}
              />
            </label>
            <label className="block text-sm font-semibold">
              Quantidade
              <input
                className="field mt-1.5"
                max="500"
                min="1"
                name="quantity"
                onChange={(event) => setQuantity(event.target.value)}
                required
                type="number"
                value={quantity}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Zeros à esquerda
            <input
              className="field mt-1.5"
              max="12"
              min="1"
              name="padding"
              onChange={(event) => setPadding(event.target.value)}
              required
              type="number"
              value={padding}
            />
          </label>
          {canPreview && (
            <p className="rounded-lg border border-[var(--line)] bg-[#11130f] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
              Prévia: {preview.join(", ")}
              {finalPreview && `, ..., ${finalPreview}`} ({count} IDs)
            </p>
          )}
        </div>
      ) : (
        <label className="block text-sm font-semibold">
          IDs dos arquivos
          <textarea
            className="field mt-1.5 min-h-36 resize-y"
            maxLength={60000}
            name="file_ids"
            placeholder={"corte-001\ncorte-002\ncorte-003"}
            required
          />
          <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">
            Cole um ID por linha. Linhas em branco serão ignoradas.
          </span>
        </label>
      )}

      <label className="block text-sm font-semibold">
        Data de renderização
        <input
          className="field mt-1.5"
          defaultValue={new Date().toISOString().slice(0, 10)}
          name="rendered_on"
          required
          type="date"
        />
      </label>
      <button className="button-primary w-full" type="submit">
        {mode === "sequence" && canPreview
          ? `Registrar lote (${count} cortes)`
          : "Registrar lote de cortes"}
      </button>
      <p className="text-xs leading-5 text-[var(--muted)]">
        Até 500 cortes por lote. Se um ID já existir, nenhum corte desse lote será registrado.
      </p>
    </form>
  );
}
