import { restoreHistoryPoint } from "@/app/actions";

export function HistoryRestoreForm({
  cutId,
  fileId,
  period,
}: {
  cutId: string;
  fileId: string;
  period: string;
}) {
  return (
    <details className="restore-details">
      <summary className="restore-trigger">Resgatar</summary>
      <div className="restore-confirm">
        <p>
          Manter <strong className="font-mono">{fileId}</strong> como último corte? Os cortes
          registrados depois deste ponto serão excluídos permanentemente. Esta ação não pode ser
          desfeita.
        </p>
        <form action={restoreHistoryPoint}>
          <input name="cut_id" type="hidden" value={cutId} />
          <input name="period" type="hidden" value={period} />
          <button className="restore-confirm-button" type="submit">
            Confirmar resgate
          </button>
        </form>
      </div>
    </details>
  );
}
