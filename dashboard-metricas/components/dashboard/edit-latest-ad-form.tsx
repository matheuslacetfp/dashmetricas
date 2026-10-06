import { updateLatestAd } from "@/app/actions";

export function EditLatestAdForm({
  lastAdId,
  disabled = false,
}: {
  lastAdId: string;
  disabled?: boolean;
}) {
  return (
    <form action={updateLatestAd} className="flex flex-wrap items-end gap-2">
      <label className="min-w-44 flex-1 text-sm font-semibold">
        Último AD gerado
        <input
          className="field mt-1.5"
          defaultValue={lastAdId}
          maxLength={100}
          name="last_ad_id"
          placeholder="Informe o ID do AD"
          required
          disabled={disabled}
        />
      </label>
      <button className="button-secondary" type="submit" disabled={disabled}>
        Salvar AD
      </button>
    </form>
  );
}
