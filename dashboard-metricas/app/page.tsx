import { cookies } from "next/headers";
import { clearUserName } from "@/app/actions";
import { ChartDateSelector } from "@/components/dashboard/chart-date-selector";
import { CutBatchForm } from "@/components/dashboard/cut-batch-form";
import { EditLatestIdForm } from "@/components/dashboard/edit-latest-id-form";
import { HistoryRestoreForm } from "@/components/dashboard/history-restore-form";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { ProductionChart } from "@/components/dashboard/production-chart";
import { UserNameForm } from "@/components/dashboard/user-name-form";
import {
  buildChartPoints,
  getChartQueryBounds,
  getSelectedDate,
  getPeriodBounds,
  isPeriod,
  type Period,
} from "@/lib/dashboard-period";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const USER_NAME_COOKIE = "dashboard_user_name";

type DashboardPageProps = {
  searchParams: Promise<{
    period?: string;
    date?: string;
    status?: string;
    count?: string;
  }>;
};

const statusMessages: Record<string, { text: string; kind: "success" | "error" }> = {
  batch_saved: { text: "Lote de cortes registrado.", kind: "success" },
  batch_duplicate: {
    text: "Um ID do lote já existe. Nenhum corte deste lote foi registrado.",
    kind: "error",
  },
  batch_error: {
    text: "Não foi possível registrar o lote. Nenhum corte foi salvo; tente novamente.",
    kind: "error",
  },
  updated: { text: "ID do último corte atualizado.", kind: "success" },
  duplicate: { text: "Esse ID já está sendo usado por outro corte.", kind: "error" },
  invalid: { text: "Confira os dados informados e tente novamente.", kind: "error" },
  batch_invalid: { text: "Confira a lista, a quantidade e os IDs do lote e tente novamente.", kind: "error" },
  invalid_name: { text: "Informe um nome com até 60 caracteres.", kind: "error" },
  update_error: { text: "Não foi possível atualizar o ID. Tente novamente.", kind: "error" },
  latest_changed: {
    text: "A lista foi atualizada desde que você abriu a edição. Confira o último corte e tente novamente.",
    kind: "error",
  },
  restored: { text: "Histórico restaurado.", kind: "success" },
  restore_missing: {
    text: "Esse ponto do histórico não existe mais. Atualize a página e escolha outro.",
    kind: "error",
  },
  restore_invalid: { text: "Não foi possível identificar o ponto selecionado.", kind: "error" },
  restore_error: {
    text: "Não foi possível restaurar o histórico. Nenhum corte foi removido.",
    kind: "error",
  },
  restore_schema: {
    text: "Execute novamente supabase/schema.sql no Supabase para habilitar o resgate do histórico.",
    kind: "error",
  },
};

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-12">
      <section className="panel page-enter w-full p-7 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--green)]">
          Produção de cortes
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Conecte seu projeto Supabase</h1>
        <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">
          A interface está pronta. Para carregar e registrar cortes, configure as chaves no arquivo
          local <code className="rounded bg-[#f0f3f0] px-1.5 py-0.5 text-sm">.env.local</code> e
          execute o script de banco incluído em <code>supabase/schema.sql</code>.
        </p>
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[#11130f] p-4 text-sm leading-6 text-[var(--muted)]">
          Copie <code>.env.example</code> para <code>.env.local</code> e preencha a URL do projeto e
          a chave pública para acessar a dashboard.
        </div>
      </section>
    </main>
  );
}

function NamePrompt({ status }: { status?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-12">
      <section className="panel page-enter w-full p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--green)]">
          Produção de cortes
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Como podemos te chamar?</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Seu nome fica salvo neste navegador para personalizar a dashboard.
        </p>
        <Feedback status={status} />
        <UserNameForm />
      </section>
    </main>
  );
}

function Feedback({ status, count }: { status?: string; count?: string }) {
  const message = status ? statusMessages[status] : undefined;
  if (!message) return null;
  const validCount = count && /^\d+$/.test(count) ? Number(count) : undefined;
  const text =
    status === "batch_saved" && validCount !== undefined
      ? `${validCount} cortes registrados com sucesso.`
      : status === "restored" && validCount !== undefined
        ? `Histórico restaurado: ${validCount} ${
            validCount === 1 ? "corte removido" : "cortes removidos"
          }. O total e o próximo ID foram recalculados.`
        : message.text;

  return (
    <p
      className={`status status-${message.kind}`}
      role={message.kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {text}
    </p>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const params = await searchParams;
  const cookieStore = await cookies();
  const userName = cookieStore.get(USER_NAME_COOKIE)?.value.trim();
  if (!userName || userName.length > 60) return <NamePrompt status={params.status} />;

  const period: Period = isPeriod(params.period) ? params.period : "month";
  const selectedDate = getSelectedDate(params.date);
  const bounds = getPeriodBounds(period, new Date(`${selectedDate}T12:00:00Z`));
  const chartBounds = getChartQueryBounds(period, bounds.start, bounds.end);
  const supabase = await createSupabaseServerClient();

  const [countResult, recentResult, chartResult] = await Promise.all([
    supabase
      .from("cuts")
      .select("id", { count: "exact", head: true })
      .gte("rendered_on", bounds.start)
      .lt("rendered_on", bounds.end),
    supabase
      .from("cuts")
      .select("id, file_id, rendered_on, created_at")
      .order("created_order", { ascending: false })
      .limit(20),
    supabase.rpc("get_cut_counts_by_day", {
      start_date: chartBounds.start,
      end_date: chartBounds.end,
    }),
  ]);

  const loadError = countResult.error ?? recentResult.error ?? chartResult.error;
  const schemaNeedsUpdate =
    loadError?.message.includes("created_order") === true ||
    loadError?.message.includes("get_cut_counts_by_day") === true ||
    loadError?.message.includes("restore_cut_history_point") === true;
  if (loadError) console.error("Failed to load dashboard data:", loadError.message);

  const recentCuts = recentResult.data ?? [];
  const latestCut = recentCuts[0];
  const latestIdParts = latestCut?.file_id.match(/^(.*?)(\d+)$/);
  const latestNumber = latestIdParts ? Number(latestIdParts[2]) : Number.NaN;
  const canSuggestNextId =
    latestIdParts !== null &&
    latestIdParts !== undefined &&
    Number.isSafeInteger(latestNumber) &&
    latestNumber < Number.MAX_SAFE_INTEGER &&
    latestIdParts[1].length + latestIdParts[2].length <= 100;
  const nextIdDefaults = canSuggestNextId
    ? {
        prefix: latestIdParts[1],
        start: latestNumber + 1,
        padding: Math.min(latestIdParts[2].length, 12),
      }
    : { prefix: "corte-", start: 1, padding: 3 };
  const chartPoints = chartResult.data
    ? buildChartPoints(period, bounds.start, chartResult.data)
    : [];
  const chartTitles: Record<Period, { title: string; description: string }> = {
    day: { title: "Dia selecionado vs. anterior", description: "Compare o dia escolhido com o dia anterior." },
    week: { title: "Semana selecionada", description: "Cortes renderizados em cada dia da semana escolhida." },
    month: { title: "Produção do mês", description: "Cortes renderizados em cada dia do mês escolhido." },
    year: { title: "Produção do ano", description: "Total de cortes renderizados em cada mês do ano escolhido." },
  };

  return (
    <main className="page-enter mx-auto min-h-screen max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--green)]">
            Painel de produção
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Olá, {userName}.
          </h1>
        </div>
        <form action={clearUserName}>
          <button className="button-secondary" type="submit">
            Trocar nome
          </button>
        </form>
      </header>

      <div className="space-y-5">
        <Feedback status={params.status} count={params.count} />

        {loadError && (
          <p className="status status-error" role="alert">
            {schemaNeedsUpdate
              ? "Atualize o Supabase executando novamente supabase/schema.sql; esta versão inclui a ordem dos lotes, o gráfico e o resgate do histórico."
              : "Não foi possível carregar os dados do Supabase. Atualize a página ou confira a conexão e as permissões da tabela."}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="panel flex flex-col justify-between gap-8 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">Cortes renderizados</p>
                <p className="mt-3 text-6xl font-bold tracking-[-0.06em]">
                  {loadError ? "—" : countResult.count ?? 0}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {period === "day"
                    ? "Dia selecionado"
                    : period === "week"
                      ? "Semana selecionada"
                      : period === "month"
                        ? "Mês selecionado"
                        : "Ano selecionado"}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                    Período
                  </span>
                  <PeriodSelector period={period} selectedDate={selectedDate} />
                </div>
                <ChartDateSelector period={period} selectedDate={selectedDate} />
              </div>
            </div>
            <div className="border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
              Contagem baseada na data de renderização, de {formatDate(bounds.start)} até{" "}
              {formatDate(bounds.lastDay)}.
            </div>
          </div>

          <div className="panel flex flex-col justify-between p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">Último ID gerado</p>
              <p className="mt-3 break-all font-mono text-3xl font-bold tracking-tight">
                {latestCut?.file_id ?? "—"}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {latestCut ? `Registrado em ${formatDate(latestCut.rendered_on)}` : "Nenhum corte cadastrado"}
              </p>
            </div>
            {latestCut && (
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <EditLatestIdForm cutId={latestCut.id} currentFileId={latestCut.file_id} />
              </div>
            )}
          </div>
        </section>

        {chartPoints.length > 0 && (
          <ProductionChart
            comparison={period === "day"}
            description={chartTitles[period].description}
            period={period}
            points={chartPoints}
            title={chartTitles[period].title}
          />
        )}

        <section className="grid items-start gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="panel p-6 sm:p-7">
            <div className="mb-5">
              <h2 className="text-lg font-bold">Registrar cortes</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Gere uma sequência ou cole uma lista para registrar até 500 de uma vez.
              </p>
            </div>
            {schemaNeedsUpdate ? (
              <p className="rounded-lg border border-[var(--line)] bg-[#11130f] p-4 text-sm leading-6 text-[var(--muted)]">
                Execute o script atualizado no Supabase antes de registrar um lote.
              </p>
            ) : (
              <CutBatchForm
                initialPadding={nextIdDefaults.padding}
                initialPrefix={nextIdDefaults.prefix}
                initialStart={nextIdDefaults.start}
              />
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
              <div>
                <h2 className="text-lg font-bold">Atividade recente</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Últimos 20 cortes. Role a lista para navegar pelos registros; resgatar um ponto
                  exclui os posteriores.
                </p>
              </div>
            </div>
            {recentCuts.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[var(--muted)]">
                {loadError ? "A atividade não pôde ser carregada." : "Seus registros aparecerão aqui."}
              </p>
            ) : (
              <div className="history-scroll overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-[#11130f] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="px-6 py-3 font-semibold">ID do arquivo</th>
                      <th className="px-6 py-3 font-semibold">Renderizado em</th>
                      <th className="px-6 py-3 font-semibold">Registrado</th>
                      <th className="px-6 py-3 text-right font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCuts.map((cut) => (
                      <tr className="border-t border-[var(--line)]" key={cut.id}>
                        <td className="px-6 py-4 font-mono font-semibold">{cut.file_id}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">{formatDate(cut.rendered_on)}</td>
                        <td className="px-6 py-4 text-[var(--muted)]">
                          {new Date(cut.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {cut.id === latestCut?.id ? (
                            <span className="text-xs font-semibold text-[var(--muted)]">Atual</span>
                          ) : (
                            <HistoryRestoreForm
                              cutId={cut.id}
                              fileId={cut.file_id}
                              period={period}
                              selectedDate={selectedDate}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
