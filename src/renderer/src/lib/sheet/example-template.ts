import type { SheetSchema, SheetComponent } from './types'

/**
 * Modelo de exemplo que vem com o app (seção 5.1): genérico no estilo d20, **sem nenhum
 * conteúdo oficial de livro**. Serve para o mestre ver como as peças se encaixam —
 * atributo com modificador, vida com máximo calculado, perícias em tabela com coluna
 * calculada e botão de rolagem — e depois copiar e adaptar para o sistema dele.
 */

const ATTRIBUTES: { key: string; label: string; x: number }[] = [
  { key: 'forca', label: 'Força', x: 0 },
  { key: 'destreza', label: 'Destreza', x: 2 },
  { key: 'constituicao', label: 'Constituição', x: 4 },
  { key: 'inteligencia', label: 'Inteligência', x: 6 },
  { key: 'sabedoria', label: 'Sabedoria', x: 8 },
  { key: 'carisma', label: 'Carisma', x: 10 }
]

const SKILLS: { key: string; label: string }[] = [
  { key: 'acrobacia', label: 'Acrobacia' },
  { key: 'atletismo', label: 'Atletismo' },
  { key: 'furtividade', label: 'Furtividade' },
  { key: 'percepcao', label: 'Percepção' },
  { key: 'persuasao', label: 'Persuasão' }
]

function attributeComponents(): SheetComponent[] {
  return ATTRIBUTES.map(({ key, label, x }) => ({
    id: `c_${key}`,
    type: 'attribute',
    key,
    label,
    editableBy: 'player',
    visibleTo: 'all',
    min: 1,
    max: 30,
    defaultValue: 10,
    // O clássico do d20: o modificador sai do valor do atributo.
    modifierFormula: 'piso((valor - 10) / 2)',
    layout: { x, y: 7, w: 2, h: 3 }
  }))
}

export function createExampleSchema(): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [
      {
        id: 'tab_personagem',
        label: 'Personagem',
        components: [
          {
            id: 'c_titulo_identidade',
            type: 'heading',
            key: 'titulo_identidade',
            label: 'Identidade',
            text: 'Identidade',
            level: 'section',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 0, y: 0, w: 12, h: 1 }
          },
          {
            id: 'c_retrato',
            type: 'image',
            key: 'retrato',
            label: 'Retrato',
            shape: 'circle',
            role: 'portrait',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 0, y: 1, w: 2, h: 5 }
          },
          {
            id: 'c_nome',
            type: 'text',
            key: 'nome',
            label: 'Nome',
            placeholder: 'Nome do personagem',
            role: 'name',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 2, y: 1, w: 5, h: 2 }
          },
          {
            id: 'c_classe',
            type: 'select',
            key: 'classe',
            label: 'Classe',
            options: [
              { id: 'o_guerreiro', label: 'Guerreiro' },
              { id: 'o_mago', label: 'Mago' },
              { id: 'o_ladino', label: 'Ladino' }
            ],
            defaultOptionId: 'o_guerreiro',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 7, y: 1, w: 3, h: 2 }
          },
          {
            id: 'c_nivel',
            type: 'number',
            key: 'nivel',
            label: 'Nível',
            min: 1,
            max: 20,
            defaultValue: 1,
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 10, y: 1, w: 2, h: 2 }
          },
          {
            id: 'c_vida',
            type: 'resource',
            key: 'vida',
            label: 'Vida',
            // Máximo por fórmula: muda sozinho quando o nível ou a constituição mudam.
            maxFormula: '=10 + constituicao.mod * nivel',
            showButtons: true,
            color: '#ef4444',
            role: 'hp',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 2, y: 3, w: 5, h: 2 }
          },
          {
            id: 'c_defesa',
            type: 'computed',
            key: 'defesa',
            label: 'Defesa',
            formula: '=10 + destreza.mod',
            format: 'integer',
            role: 'defense',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 7, y: 3, w: 2, h: 2 }
          },
          {
            id: 'c_proficiencia',
            type: 'computed',
            key: 'proficiencia',
            label: 'Proficiência',
            formula: '=1 + teto(nivel / 4)',
            format: 'signed',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 9, y: 3, w: 3, h: 2 }
          },
          {
            id: 'c_iniciativa',
            type: 'rollButton',
            key: 'iniciativa',
            label: 'Iniciativa',
            formula: '1d20 + {destreza.mod}',
            critical: { kind: 'none' },
            criticalFailureOnOne: false,
            role: 'initiative',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 2, y: 5, w: 3, h: 2 }
          },
          {
            id: 'c_visao',
            type: 'number',
            key: 'visao',
            label: 'Visão (m)',
            min: 0,
            defaultValue: 9,
            role: 'vision',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 5, y: 5, w: 2, h: 2 }
          },
          {
            id: 'c_titulo_atributos',
            type: 'heading',
            key: 'titulo_atributos',
            label: 'Atributos',
            text: 'Atributos',
            level: 'section',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 0, y: 6, w: 12, h: 1 }
          },
          ...attributeComponents(),
          {
            id: 'c_notas_mestre',
            type: 'textarea',
            key: 'notas_mestre',
            label: 'Anotações do mestre',
            hint: 'O jogador nem recebe este campo.',
            editableBy: 'gm',
            // Exemplo de campo só do mestre (seção 5.3).
            visibleTo: 'gm',
            layout: { x: 0, y: 10, w: 6, h: 3 }
          }
        ]
      },
      {
        id: 'tab_pericias',
        label: 'Perícias',
        components: [
          {
            id: 'c_titulo_pericias',
            type: 'heading',
            key: 'titulo_pericias',
            label: 'Perícias',
            text: 'Marque o que o personagem é treinado e role direto da tabela',
            level: 'section',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 0, y: 0, w: 12, h: 1 }
          },
          {
            id: 'c_pericias',
            type: 'table',
            key: 'pericias',
            label: 'Perícias',
            columns: [
              { id: 'col_treinado', key: 'treinado', label: 'Treino', kind: 'checkbox', width: 12 },
              { id: 'col_bonus', key: 'bonus', label: 'Bônus', kind: 'number', width: 14 },
              {
                id: 'col_total',
                key: 'total',
                label: 'Total',
                kind: 'computed',
                // Colunas calculadas usam as colunas da própria linha pelo nome (5.4).
                formula: '=bonus + se(treinado, proficiencia, 0)',
                format: 'signed',
                width: 14
              },
              {
                id: 'col_rolar',
                key: 'rolar',
                label: 'Rolar',
                kind: 'rollButton',
                formula: '1d20 + {total}',
                critical: { kind: 'natural' },
                criticalFailureOnOne: true,
                width: 16
              }
            ],
            rows: SKILLS.map((skill) => ({
              id: `row_${skill.key}`,
              key: skill.key,
              label: skill.label
            })),
            playerCanAddRows: false,
            showRowLabels: true,
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 0, y: 1, w: 12, h: 8 }
          }
        ]
      },
      {
        id: 'tab_inventario',
        label: 'Inventário',
        components: [
          {
            id: 'c_inventario',
            type: 'table',
            key: 'inventario',
            label: 'Mochila',
            columns: [
              { id: 'col_item', key: 'item', label: 'Item', kind: 'text', width: 50 },
              { id: 'col_peso', key: 'peso', label: 'Peso', kind: 'number', width: 25 },
              { id: 'col_qtd', key: 'quantidade', label: 'Qtd.', kind: 'number', width: 25 }
            ],
            rows: [],
            playerCanAddRows: true,
            showRowLabels: false,
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 0, y: 0, w: 8, h: 7 }
          },
          {
            id: 'c_peso_total',
            type: 'computed',
            key: 'peso_total',
            label: 'Peso total',
            formula: '=soma(inventario.peso)',
            format: 'decimal',
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 8, y: 0, w: 4, h: 2 }
          },
          {
            id: 'c_anotacoes',
            type: 'textarea',
            key: 'anotacoes',
            label: 'Anotações',
            editableBy: 'player',
            visibleTo: 'all',
            layout: { x: 8, y: 2, w: 4, h: 5 }
          }
        ]
      }
    ]
  }
}

export const EXAMPLE_TEMPLATE_NAME = 'Exemplo d20'
