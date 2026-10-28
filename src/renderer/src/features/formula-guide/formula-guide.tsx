import type { ReactNode } from 'react'
import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormulaPlayground } from './formula-playground'
import {
  ARITHMETIC_EXAMPLES,
  ATTRIBUTE_EXAMPLES,
  BAR_EXAMPLES,
  describeValue,
  ERROR_EXAMPLES,
  evaluateExample,
  evaluateGuideFormula,
  FUNCTION_EXAMPLES,
  interpolateGuideRoll,
  LOGIC_EXAMPLES,
  RECIPE_EXAMPLES,
  REFERENCE_EXAMPLES,
  ROLL_EXAMPLES,
  SAMPLE_TABLE,
  TABLE_EXAMPLES,
  VISIBILITY_EXAMPLES,
  type ErrorExample,
  type FormulaExample,
  type RollExample
} from './guide-sample'

const SECTIONS = [
  { id: 'guia-pecas', title: 'Como as peças se ligam' },
  { id: 'guia-passo-a-passo', title: 'Passo a passo' },
  { id: 'guia-ficha-exemplo', title: 'A ficha dos exemplos' },
  { id: 'guia-contas', title: 'Contas' },
  { id: 'guia-referencias', title: 'Usando outros campos' },
  { id: 'guia-funcoes', title: 'Funções' },
  { id: 'guia-condicoes', title: 'Comparações e condições' },
  { id: 'guia-atributos', title: 'Atributos e modificadores' },
  { id: 'guia-barras', title: 'Barras e marcadores' },
  { id: 'guia-tabelas', title: 'Tabelas' },
  { id: 'guia-rolagens', title: 'Botões de rolagem' },
  { id: 'guia-visibilidade', title: 'Mostrar só às vezes' },
  { id: 'guia-papeis', title: 'Papéis na mesa' },
  { id: 'guia-receitas', title: 'Receitas prontas' },
  { id: 'guia-erros', title: 'Quando aparece #ERRO' },
  { id: 'guia-experimente', title: 'Experimente' }
] as const

type SectionId = (typeof SECTIONS)[number]['id']

interface FormulaGuideProps {
  /** Dentro da janela do construtor: índice em linha no topo, sem a coluna lateral. */
  compact?: boolean
}

/**
 * Guia de fórmulas: como escrever fórmulas e ligar um componente ao outro.
 *
 * Os resultados ao lado de cada exemplo não estão escritos à mão: são calculados agora,
 * pelo mesmo motor da ficha, sobre a ficha de exemplo (e o teste confere cada um).
 */
export function FormulaGuide({ compact = false }: FormulaGuideProps): React.JSX.Element {
  return (
    <div className={cn(!compact && 'grid gap-8 lg:grid-cols-[13rem_1fr]')}>
      <TableOfContents compact={compact} />

      <article className="min-w-0 space-y-10 pb-10 text-sm leading-relaxed">
        <Section id="guia-pecas">
          <p>
            Todo componente da ficha tem um <strong>rótulo</strong>, que é o que o jogador lê
            (“Força”), e uma <strong>chave</strong>, que é o nome dele dentro das fórmulas (
            <Code>forca</Code>). A chave é o fio que liga um componente ao outro: o Campo calculado
            “Defesa” enxerga a Destreza porque a fórmula dele diz <Code>destreza.mod</Code>.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              A chave nasce do rótulo, sem acento, em minúsculas e com <Code>_</Code> no lugar dos
              espaços: “Pontos de Esforço” vira <Code>pontos_de_esforco</Code>.
            </li>
            <li>
              Para ver ou mudar a chave, clique no componente na grade: ela aparece no painel da
              direita, logo abaixo do rótulo. Enquanto você não mexer nela, ela acompanha o rótulo
              sozinha.
            </li>
            <li>
              Trocou a chave? O app reescreve todas as fórmulas que usavam a antiga. E os valores
              que os jogadores preencheram não se perdem: eles são guardados por um código interno
              do componente, não pela chave.
            </li>
            <li>
              A chave começa com letra e usa só letras, números e <Code>_</Code>. As palavras{' '}
              <Code>e</Code>, <Code>ou</Code>, <Code>nao</Code>, <Code>valor</Code> e os nomes das
              funções são reservados.
            </li>
          </ul>
          <p>Onde dá para escrever fórmula, no painel de propriedades:</p>
          <SimpleTable
            head={['Componente', 'Campo', 'Para quê']}
            rows={[
              [
                'Campo calculado',
                'Fórmula',
                'Um número (ou texto) calculado a partir de outros campos'
              ],
              ['Atributo', 'Fórmula do modificador', 'Como o modificador sai do valor'],
              [
                'Barra de recurso',
                'Máximo por fórmula',
                'Vida, mana ou sanidade que crescem com a ficha'
              ],
              ['Marcadores', 'Quantidade por fórmula', 'Quantas bolinhas aparecem'],
              ['Botão de rolagem', 'Fórmula da rolagem', 'Os dados, com contas entre { }'],
              ['Tabela', 'Colunas “Calculado” e “Rolagem”', 'Uma conta ou rolagem por linha'],
              ['Qualquer um', 'Condição de visibilidade', 'Mostrar o componente só em alguns casos']
            ]}
          />
        </Section>

        <Section id="guia-passo-a-passo">
          <p>Uma ficha pequena no estilo d20, do zero, para ver as peças funcionando juntas:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Arraste um <strong>Número</strong> para a grade e chame de “Nível”. A chave vira{' '}
              <Code>nivel</Code>.
            </li>
            <li>
              Arraste um <strong>Atributo</strong> e chame de “Constituição”. Ele já vem com a
              fórmula de modificador <Code>piso((valor - 10) / 2)</Code>.
            </li>
            <li>
              Arraste uma <strong>Barra de recurso</strong>, chame de “Vida”, apague o “Máximo fixo”
              e escreva no “Máximo por fórmula”: <Code>=10 + constituicao.mod * nivel</Code>. No
              painel, em “Papel na mesa”, escolha “Vida”.
            </li>
            <li>
              Arraste um <strong>Botão de rolagem</strong>, chame de “Teste de Constituição” e
              escreva <Code>1d20 + {'{constituicao.mod}'}</Code>. Em “Crítico”, escolha “Natural”.
            </li>
            <li>
              Clique em <strong>Ver como jogador</strong>, mude o Nível e a Constituição e veja a
              Vida máxima mudar. Clique em “Rolar” para testar o botão.
            </li>
            <li>
              Clique em <strong>Validar</strong>: ele aponta chave repetida, fórmula com erro e
              campo que não existe. Com tudo certo, <strong>Publicar</strong> libera o modelo para
              os jogadores.
            </li>
          </ol>
        </Section>

        <Section id="guia-ficha-exemplo">
          <p>
            Todos os exemplos deste guia são calculados sobre esta ficha. Os resultados que aparecem
            em verde saem do mesmo motor que a ficha do jogador usa.
          </p>
          <SimpleTable
            head={['Chave', 'O que é', 'Valor']}
            rows={SAMPLE_TABLE.map((row) => [<Code key="k">{row.key}</Code>, row.what, row.value])}
          />
        </Section>

        <Section id="guia-contas">
          <p>
            Um <strong>Campo calculado</strong> começa com <Code>=</Code>. Depois dele vem a conta,
            com <Code>+</Code> <Code>-</Code> <Code>*</Code> <Code>/</Code> (resto da divisão:{' '}
            <Code>%</Code>; potência: <Code>^</Code>) e parênteses. Número quebrado se escreve com
            ponto (<Code>2.5</Code>); a ficha mostra com vírgula.
          </p>
          <Examples examples={ARITHMETIC_EXAMPLES} />
          <Tip>
            O formato do campo calculado muda só a exibição: “Inteiro” mostra 2, “Com sinal” mostra
            +2 (bom para modificadores) e “Decimal” mostra 2,5.
          </Tip>
        </Section>

        <Section id="guia-referencias">
          <p>
            Escreva a chave de outro componente e a fórmula usa o valor dele. O que cada tipo
            entrega:
          </p>
          <SimpleTable
            head={['Componente', 'Na fórmula', 'Vale']}
            rows={[
              ['Número', <Code key="c">nivel</Code>, 'O número'],
              ['Atributo', <Code key="c">forca</Code>, 'O valor do atributo'],
              [
                'Atributo',
                <Code key="c">forca.mod</Code>,
                'O modificador (da fórmula do atributo)'
              ],
              ['Barra de recurso', <Code key="c">vida</Code>, 'O valor atual'],
              ['Barra de recurso', <Code key="c">vida.max</Code>, 'O máximo'],
              ['Caixa de seleção', <Code key="c">escudo</Code>, '1 se marcada, 0 se não'],
              [
                'Lista de opções',
                <Code key="c">treinamento</Code>,
                'O número da opção; sem número, o texto'
              ],
              ['Texto', <Code key="c">nome</Code>, 'O texto'],
              ['Marcadores', <Code key="c">dados_de_vida</Code>, 'Quantas bolinhas estão marcadas'],
              ['Campo calculado', <Code key="c">defesa</Code>, 'O resultado da fórmula dele'],
              [
                'Tabela',
                <Code key="c">pericias.furtividade.total</Code>,
                'Uma célula: tabela.linha.coluna'
              ],
              ['Título, Imagem, Botão', '—', 'Não entram em contas']
            ]}
          />
          <Examples examples={REFERENCE_EXAMPLES} />
          <Tip>
            Campo vazio conta como 0 (ou texto vazio): um atributo em branco não estraga a ficha
            inteira. Já uma chave que não existe vira <Code>#ERRO</Code>.
          </Tip>
        </Section>

        <Section id="guia-funcoes">
          <p>As funções têm nome em português e um apelido em inglês — os dois funcionam.</p>
          <SimpleTable
            head={['Função', 'Apelido', 'O que faz']}
            rows={[
              [<Code key="f">piso(x)</Code>, 'floor', 'Arredonda para baixo'],
              [<Code key="f">teto(x)</Code>, 'ceil', 'Arredonda para cima'],
              [
                <Code key="f">arred(x)</Code>,
                'round',
                'Arredonda para o mais perto (o meio se afasta do zero)'
              ],
              [<Code key="f">min(a, b, …)</Code>, '—', 'O menor valor'],
              [<Code key="f">max(a, b, …)</Code>, '—', 'O maior valor'],
              [<Code key="f">abs(x)</Code>, '—', 'Tira o sinal'],
              [<Code key="f">se(cond, sim, não)</Code>, 'if', 'Escolhe um dos dois valores'],
              [
                <Code key="f">soma(…)</Code>,
                'sum',
                'Soma valores, ou uma coluna inteira da tabela'
              ],
              [<Code key="f">contar(tabela)</Code>, 'count', 'Quantas linhas a tabela tem']
            ]}
          />
          <Examples examples={FUNCTION_EXAMPLES} />
        </Section>

        <Section id="guia-condicoes">
          <p>
            Comparações dão verdadeiro ou falso — e verdadeiro vale 1 nas contas, falso vale 0.
            Texto vai sempre entre aspas, e maiúsculas contam: <Code>&quot;Ocultista&quot;</Code>{' '}
            não é igual a <Code>&quot;ocultista&quot;</Code>.
          </p>
          <Examples examples={LOGIC_EXAMPLES} />
          <Tip>
            O <Code>se</Code> só calcula o lado escolhido. Por isso{' '}
            <Code>se(vida == 0, 0, 100 / vida)</Code> não dá erro de divisão por zero.
          </Tip>
        </Section>

        <Section id="guia-atributos">
          <p>
            Na fórmula do modificador, <Code>valor</Code> é o próprio número do atributo. O
            resultado fica disponível para o resto da ficha como <Code>chave.mod</Code>.
          </p>
          <Examples examples={ATTRIBUTE_EXAMPLES} />
          <p>
            Sistemas sem modificador (como Ordem Paranormal) deixam a fórmula do modificador vazia e
            usam o atributo direto — por exemplo, como quantidade de dados no botão de rolagem:{' '}
            <Code>{'{agilidade}'}d20kh1</Code>.
          </p>
        </Section>

        <Section id="guia-barras">
          <p>
            A <strong>Barra de recurso</strong> tem valor atual e máximo. O máximo pode ser um
            número fixo ou uma fórmula; se as duas coisas estiverem preenchidas, a fórmula vale. Nas
            outras fórmulas, <Code>vida</Code> é o atual e <Code>vida.max</Code> o máximo.
          </p>
          <Examples examples={BAR_EXAMPLES} />
          <p>
            Os <strong>Marcadores</strong> (bolinhas) também aceitam a quantidade por fórmula — por
            exemplo, uma bolinha de dado de vida por nível: <Code>=nivel</Code>.
          </p>
        </Section>

        <Section id="guia-tabelas">
          <p>A tabela tem colunas (com chave cada uma) e linhas, de dois jeitos:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Linhas fixas</strong>, que o mestre define (as perícias). Cada linha tem uma
              chave — é ela que aparece no meio de <Code>pericias.furtividade.total</Code>.
            </li>
            <li>
              <strong>Linhas do jogador</strong>, com “O jogador adiciona linhas” ligado (o
              inventário). Essas não têm nome fixo; use <Code>soma</Code> e <Code>contar</Code>{' '}
              nelas.
            </li>
          </ul>
          <p>
            Uma coluna <strong>Calculado</strong> usa as outras colunas <em>da mesma linha</em> pelo
            nome. Na tabela de perícias da ficha de exemplo, a coluna “Total” tem a fórmula{' '}
            <Code>=atributo + treino + bonus</Code> — e cada linha soma os próprios números.
          </p>
          <Examples examples={TABLE_EXAMPLES} />
          <Tip>
            Dentro da tabela, a coluna também enxerga o resto da ficha: uma coluna calculada pode
            ser <Code>=atributo + treino + proficiencia</Code>.
          </Tip>
        </Section>

        <Section id="guia-rolagens">
          <p>
            A fórmula de rolagem usa a notação de dados de sempre. Trechos entre chaves{' '}
            <Code>{'{ }'}</Code> são calculados <em>antes</em> de rolar, com a ficha de quem clicou
            — e podem devolver número ou texto.
          </p>
          <SimpleTable
            head={['Notação', 'Significa']}
            rows={[
              [<Code key="n">1d20</Code>, 'Um dado de 20 lados (d20 também vale)'],
              [<Code key="n">2d6+3</Code>, 'Dois d6 somados, mais 3'],
              [<Code key="n">2d20kh1</Code>, 'Dois d20, fica com o maior (vantagem)'],
              [<Code key="n">2d20kl1</Code>, 'Dois d20, fica com o menor (desvantagem)'],
              [<Code key="n">4d6kh3</Code>, 'Quatro d6, fica com os três maiores'],
              [<Code key="n">3d6!</Code>, 'Dado que tira o máximo explode: rola de novo e soma'],
              [<Code key="n">1d100</Code>, 'Porcentagem']
            ]}
          />
          <RollExamples examples={ROLL_EXAMPLES} />
          <p>
            <strong>Crítico</strong>, escolhido por botão: “Nenhum”; “Natural”, quando o d20{' '}
            <em>mantido</em> tira 20; ou “Margem”, quando o d20 mantido tira o limiar ou mais. O
            limiar pode ser um número (<Code>19</Code>) ou a chave de um campo da ficha (
            <Code>margem_critico</Code>), para armas com margem diferente. “Falha crítica no 1” liga
            o aviso quando o d20 mantido tira 1.
          </p>
          <Tip>
            Num <Code>2d20kh1</Code>, o dado descartado não conta para o crítico: só o que ficou.
          </Tip>
        </Section>

        <Section id="guia-visibilidade">
          <p>
            A <strong>Condição de visibilidade</strong> é uma fórmula que decide se o componente
            aparece na ficha do jogador. Vazia, ele sempre aparece. Não precisa do <Code>=</Code>.
          </p>
          <Examples examples={VISIBILITY_EXAMPLES} />
          <p>
            Isto é diferente de <strong>Quem vê</strong> e <strong>Quem edita</strong>: “Só o
            mestre” em “Quem vê” esconde o campo do jogador sempre (o valor nem chega no computador
            dele); “Só o mestre” em “Quem edita” deixa o jogador ver, mas não mudar.
          </p>
        </Section>

        <Section id="guia-papeis">
          <p>
            O app não sabe o que é “Vida” na sua ficha. O <strong>Papel na mesa</strong>, no painel
            de propriedades, conta para ele — e é o que liga a ficha ao tabuleiro. Cada papel vai em
            no máximo um componente.
          </p>
          <SimpleTable
            head={['Papel', 'Componente', 'Usado em']}
            rows={[
              ['Nome do personagem', 'Texto curto', 'Nome do token'],
              ['Retrato', 'Imagem', 'Imagem do token'],
              ['Vida', 'Barra de recurso', 'Barra de vida do token, dano e cura'],
              ['Barra extra 2 e 3', 'Barra de recurso', 'Barras a mais no token (Sanidade, PE…)'],
              [
                'Iniciativa',
                'Botão de rolagem ou número',
                'Rolar iniciativa (número vira 1d20 + ele)'
              ],
              ['Defesa', 'Número, calculado ou atributo', 'Card do token e combate'],
              ['Visão', 'Número ou calculado (metros)', 'Raio de visão na névoa']
            ]}
          />
        </Section>

        <Section id="guia-receitas">
          <p>Fórmulas de sistemas de verdade, para copiar e adaptar às chaves da sua ficha:</p>
          <Examples examples={RECIPE_EXAMPLES} />
        </Section>

        <Section id="guia-erros">
          <p>
            Fórmula com problema nunca quebra a ficha: o campo mostra <Code>#ERRO</Code> e, parando
            o mouse em cima, o motivo. Os mais comuns:
          </p>
          <ErrorExamples examples={ERROR_EXAMPLES} />
          <p>
            Outro erro clássico é a <strong>dependência circular</strong>: o campo A usa B e o B usa
            A. Não tem como calcular nenhum dos dois, e o <strong>Validar</strong> avisa antes de
            publicar. Ele também aponta chave repetida, campo inexistente e campo visível ao jogador
            que depende de um campo só do mestre.
          </p>
        </Section>

        <Section id="guia-experimente">
          <p>
            Escreva qualquer fórmula: ela é calculada na hora sobre a ficha dos exemplos. Na aba
            “Rolagem”, o botão rola de verdade.
          </p>
          <FormulaPlayground />
        </Section>
      </article>
    </div>
  )
}

function TableOfContents({ compact }: { compact: boolean }): React.JSX.Element {
  function go(id: SectionId): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (compact) {
    return (
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Seções do guia">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => go(section.id)}
            className="bg-muted hover:bg-accent rounded-md px-2 py-1 text-xs transition-colors"
          >
            {section.title}
          </button>
        ))}
      </nav>
    )
  }

  return (
    <nav className="hidden lg:block" aria-label="Seções do guia">
      <ol className="sticky top-6 space-y-0.5 border-l text-sm">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => go(section.id)}
              className="text-muted-foreground hover:text-foreground hover:border-primary -ml-px block w-full border-l border-transparent py-1 pl-3 text-left transition-colors"
            >
              {section.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Section({ id, children }: { id: SectionId; children: ReactNode }): React.JSX.Element {
  const title = SECTIONS.find((section) => section.id === id)?.title ?? ''
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function Code({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.85em] whitespace-nowrap">
      {children}
    </code>
  )
}

function Tip({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="border-primary/30 bg-primary/5 flex gap-2 rounded-md border px-3 py-2">
      <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Fórmula → resultado calculado agora, com a explicação ao lado. */
function Examples({ examples }: { examples: FormulaExample[] }): React.JSX.Element {
  return (
    <div className="divide-y rounded-md border">
      {examples.map((example, index) => {
        const result = evaluateExample(example)
        return (
          <ExampleRow
            key={index}
            formula={example.formula}
            result={result.ok ? describeValue(result.value) : `#ERRO — ${result.error.message}`}
            ok={result.ok}
            note={example.note}
          />
        )
      })}
    </div>
  )
}

function RollExamples({ examples }: { examples: RollExample[] }): React.JSX.Element {
  return (
    <div className="divide-y rounded-md border">
      {examples.map((example, index) => {
        const result = interpolateGuideRoll(example.formula, {
          overrides: example.overrides,
          row: example.row
        })
        return (
          <ExampleRow
            key={index}
            formula={example.formula}
            result={result.ok ? `rola ${result.value}` : `#ERRO — ${result.error.message}`}
            ok={result.ok}
            note={example.note}
          />
        )
      })}
    </div>
  )
}

function ErrorExamples({ examples }: { examples: ErrorExample[] }): React.JSX.Element {
  return (
    <div className="divide-y rounded-md border">
      {examples.map((example, index) => {
        const result = evaluateGuideFormula(example.formula)
        return (
          <ExampleRow
            key={index}
            formula={example.formula}
            result={result.ok ? describeValue(result.value) : result.error.message}
            ok={false}
            note={example.note}
          />
        )
      })}
    </div>
  )
}

function ExampleRow({
  formula,
  result,
  ok,
  note
}: {
  formula: string
  result: string
  ok: boolean
  note: string
}): React.JSX.Element {
  return (
    <div className="grid gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-0.5">
        <code className="block font-mono text-[0.85em] break-all">{formula}</code>
        <p className="text-muted-foreground text-xs">{note}</p>
      </div>
      <p
        className={cn(
          'flex items-start gap-1.5 text-xs font-medium',
          ok ? 'text-emerald-400' : 'text-destructive'
        )}
      >
        {ok ? (
          <CheckCircle2 className="mt-px size-3.5 shrink-0" />
        ) : (
          <XCircle className="mt-px size-3.5 shrink-0" />
        )}
        <span className="min-w-0 break-words">{result}</span>
      </p>
    </div>
  )
}
