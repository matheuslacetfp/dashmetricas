# Dashboard de produção de cortes

Dashboard simples para registrar arquivos renderizados, contar cortes por período e editar o ID do registro mais recente.

## Rodar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os dados do seu projeto Supabase.
3. Execute o conteúdo atualizado de `supabase/schema.sql` no SQL Editor do Supabase. Se a tabela `cuts` já existia, execute o script novamente para adicionar a coluna `created_order` e as funções dos gráficos, incluindo a comparação dos totais anuais, e do resgate.
4. Inicie com `npm run dev` e abra `http://localhost:3000`.

## Dados e acesso

Cada linha da tabela `cuts` representa um arquivo. É possível registrar até 500 cortes por envio, colando IDs (um por linha) ou gerando uma sequência com prefixo, número inicial e quantidade. O lote usa uma única operação de inserção e é rejeitado por inteiro se algum ID já existir. `file_id` é único; `rendered_on` alimenta os filtros de dia, semana, mês e ano e os gráficos agregados no banco. É possível escolher a data, o mês ou o ano observado; normalmente o KPI e o gráfico usam essa mesma seleção. Na visão anual, alterne entre a distribuição mensal do ano observado e uma comparação dos totais de todos os anos com registros; nessa comparação, o ano escolhido continua controlando o KPI. Ao passar o mouse ou focar um ponto do gráfico, são exibidos o período/data e o número de cortes correspondente. `created_order` identifica com precisão a ordem dos registros, inclusive dentro de um lote. A edição do ID é restrita ao registro mais recente.

O painel **Controle de ADs** armazena separadamente o último AD gerado na linha única `ad_progress`; informe o novo valor e salve para atualizá-lo. Execute `supabase/schema.sql` no SQL Editor para criar essa tabela e suas políticas de acesso.

O histórico mostra os 20 cortes mais recentes em uma área rolável. **Resgatar** um ponto mantém esse corte e remove permanentemente todos os registros posteriores; o dashboard recalcula o total e o último ID a partir do histórico restante e, quando o ID termina em números, sugere a sequência seguinte a partir desse ponto. A ação exige confirmação e é executada em uma única função transacional do banco. O SQL revoga a exclusão direta pelo papel anônimo e permite o rollback somente pela função dedicada; como a aplicação é aberta, qualquer pessoa com acesso à dashboard pode confirmar essa ação.

A aplicação pede apenas um nome de exibição e o guarda em um cookie HttpOnly no navegador por um ano. Esse nome não autentica nem protege os dados. Para esse uso pessoal/interno, a política RLS do script permite acesso de leitura e gravação ao papel `anon`; qualquer pessoa com acesso à aplicação poderá consultar, cadastrar e alterar cortes. Não coloque uma chave `service_role` no frontend nem no arquivo `.env.local`.
