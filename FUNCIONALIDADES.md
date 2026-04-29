# Como Funciona o App

## Visao Geral

O app foi criado para coletar dados de pressao arterial de forma simples, rapida e segura no celular.

O fluxo principal e guiado, mostrando um campo por vez, para reduzir erros de digitacao e acelerar o preenchimento durante o atendimento.

## Protecao Inicial

O app possui uma senha fixa de entrada para evitar acesso casual por curiosos.

Senha atual: `m@rsaude`

Importante:

- essa barreira e leve
- ela ajuda no uso operacional do dia a dia
- ela nao substitui autenticacao forte
- o app so inicializa os dados locais e a fila pendente depois do desbloqueio
- a senha fica centralizada em `APP_CONFIG.access.password` em [app.js](/Users/felipelima/work/pressao-arterial/app.js)

## Fluxo de Uso

1. O usuario informa o nome da empresa.
2. Depois disso, a empresa fica salva no aparelho e nao precisa ser digitada novamente para cada paciente.
3. Para cada novo paciente, o app pede:
   - CPF
   - Nome do paciente
   - Pressao sistolica
   - Pressao diastolica
4. Ao finalizar, o app tenta enviar os dados para o Google Sheets.
5. Depois do envio, o fluxo volta automaticamente para o CPF do proximo paciente.

## Dados Coletados

O app registra os seguintes campos:

- Data e Hora
- Empresa
- CPF
- NomePaciente
- Pressao Sistolica
- Pressao Diastolica
- Resumo Sisto/Diast

## Validacoes

O app possui validacoes para reduzir erros de preenchimento:

- CPF com mascara visual durante a digitacao
- Validacao completa de CPF
- CPF salvo e enviado sem mascara, apenas com numeros
- Nome com tamanho minimo
- Pressao sistolica e diastolica aceitando apenas numeros
- Faixa valida de pressao
- Validacao para garantir que a diastolica seja menor que a sistolica

## Experiencia Mobile

O design foi pensado com prioridade total para celular:

- Um campo por vez
- Foco automatico no input atual
- Teclado numerico nos campos de numeros
- Placeholders com exemplos
- Explicacao simples do que e sistolica e diastolica
- Interface limpa para evitar confusao

## Persistencia de Dados

O app salva os dados localmente no aparelho para evitar perda de informacoes.

Mesmo se acontecer:

- reload da pagina
- fechamento acidental
- queda de conexao
- falha no envio

os dados continuam salvos no dispositivo.

O app restaura automaticamente:

- empresa atual
- rascunho em andamento
- fila de envios pendentes
- historico salvo no celular

## Envio para Google Sheets

O envio e feito por um Google Apps Script publicado como Web App.

Quando o usuario conclui um cadastro:

1. o registro entra primeiro em uma fila local
2. o app tenta enviar para o Google Sheets
3. so remove da fila quando o servidor confirma o recebimento

Isso reduz o risco de perder dados em conexoes ruins.

## Fila de Pendentes

Se o envio falhar ou demorar demais:

- o cadastro fica salvo na fila
- o usuario pode continuar usando o app normalmente
- o app pode reenviar depois
- o usuario tambem pode tocar em `Enviar pendentes`

O app mostra:

- quantidade de pendentes
- lista resumida dos registros aguardando envio

## Protecao Contra Duplicidade

Cada registro recebe um `recordId`.

Esse identificador permite que o Google Apps Script reconheca reenvios do mesmo cadastro e evite duplicidade na planilha.

## Backup Manual em CSV

O app tambem possui uma segunda estrategia de seguranca:

- todos os registros ficam salvos localmente no celular
- o usuario pode exportar um CSV completo
- o usuario pode exportar um CSV apenas dos pendentes

O CSV pode ser:

- compartilhado
- copiado como texto
- baixado no aparelho

## Compartilhamento

Quando o dispositivo suporta compartilhamento nativo, o usuario pode enviar o CSV para:

- WhatsApp
- Slack
- Mensagens
- e-mail
- outros aplicativos compativeis

## Uso Offline

O app foi preparado para funcionar offline no dispositivo.

Sem internet, o usuario ainda consegue:

- abrir o app
- preencher novos pacientes
- salvar dados
- manter fila local
- exportar CSV

Quando a internet voltar, os envios pendentes podem ser reenviados.

## Instalacao Como App

O projeto funciona como PWA, podendo ser instalado no celular.

Quando instalado:

- abre como aplicativo
- funciona em tela cheia
- mantem os arquivos principais em cache
- melhora o uso recorrente no celular

## Build e Publicacao

O projeto usa Webpack para gerar uma versao pronta para publicacao.

Comandos principais:

```bash
npm run dev
npm run build
npm run preview
```

Saida de publicacao:

- pasta `dist/`

## Resumo das Funcionalidades

- Fluxo guiado um campo por vez
- Empresa salva uma unica vez
- Validacao de CPF
- CPF enviado sem mascara
- Validacao de pressao arterial
- Reenvio automatico de pendentes
- Fila local persistente
- Backup manual em CSV
- Exportacao de todos os registros
- Exportacao apenas dos pendentes
- Compartilhamento nativo no celular
- Restauracao apos reload
- Uso offline
- Instalacao como app
- Integracao com Google Sheets
