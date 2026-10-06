import { updateLatestCutId } from "@/app/actions";

export function EditLatestIdForm({
  cutId,
  currentFileId,
}: {
  cutId: string;
  currentFileId: string;
}) {
  return (
    <form action={updateLatestCutId} className="flex flex-wrap items-end gap-2">
      <input name="cut_id" type="hidden" value={cutId} />
      <label className="min-w-44 flex-1 text-sm font-semibold">
        Editar ID
        <input
          className="field mt-1.5"
          defaultValue={currentFileId}
          maxLength={100}
          name="file_id"
          required
        />
      </label>
      <button className="button-secondary" type="submit">
        Salvar ID
      </button>
    </form>
  );
}
