# PROMPT — CRIAR FICHA COMPLETA DE RPG FANTASIA

Crie uma ficha completa, funcional, organizada e editável para um RPG de fantasia original, voltado para campanhas curtas, combates rápidos e decisões estratégicas. 
A ficha deve conter campos editáveis, seletores de raça e classe, cálculos automáticos quando possível, habilidades selecionáveis por nível, inventário, equipamentos, magias, recursos de combate e acompanhamento da progressão do personagem.

Não crie apenas um formulário visual: organize os campos e as regras de maneira que possam ser utilizados durante a sessão de RPG.

# 1. ESTRUTURA PRINCIPAL DA FICHA

A ficha deve conter as seguintes seções:

## 1.1. Identificação
- Nome do personagem.
- Nome do jogador.
- Raça.
- Classe.
- Nível do personagem: 1, 2 ou 3.
- Experiência atual e experiência necessária para subir de nível.
- História ou descrição do personagem, opcional.
- Retrato ou imagem do personagem, opcional.

## 1.2. Atributos
Utilize os seguintes atributos:

- **FOR — Força:** influencia ataques físicos, dano de armas pesadas e testes de força.
- **AGI — Agilidade:** influencia iniciativa, esquiva, precisão com armas ágeis e movimentação.
- **INT — Inteligência:** influencia conhecimentos, resolução de enigmas e poder das magias do Mago.
- **ESP — Espírito:** influencia resistência mental, poder divino do Clérigo e controle das energias sobrenaturais.
- **VIG — Vigor:** influencia os pontos de vida e a resistência física.

Todos os atributos devem ter valores numéricos editáveis.

## 1.3. Recursos calculados automaticamente

Utilize estas fórmulas como padrão inicial do sistema:

- **Vida máxima (PV):** valor-base da classe + (VIG × 3) + bônus racial.
- **Energia máxima (PE):** valor-base da classe + (ESP × 2) + bônus racial.
- **Defesa:** 10 + AGI + bônus de armadura ou escudo.
- **Iniciativa:** resultado de 1d20 + AGI.
- **Ataque físico:** resultado de 1d20 + atributo de ataque + bônus da arma.
- **Ataque mágico:** resultado de 1d20 + atributo mágico + bônus de foco mágico.
- **Dano final:** dano-base da habilidade ou arma + modificadores aplicáveis, menos a redução de dano do alvo, respeitando o mínimo de zero.

Para evitar números excessivos, os atributos iniciais devem normalmente ficar entre 0 e 5. O mestre pode editar os valores.

Ao criar um personagem, cada atributo começa em 0. O jogador recebe 7 pontos para distribuir, respeitando o limite inicial de 5. A raça pode modificar os atributos depois dessa distribuição.

Cada atributo tem um **modificador** igual ao valor do atributo (já com a raça) menos 1: 0 dá -1, 1 dá 0, 2 dá +1, 3 dá +2, e assim por diante. Um atributo que a raça leva a -1 tem modificador -2. É o modificador que entra nas fórmulas acima (VIG × 3, ESP × 2, Defesa, Iniciativa, ataques, testes e valores das habilidades). Requisitos de equipamento, como a FOR exigida por uma arma, comparam com o valor do atributo.

Se uma habilidade disser que ignora defesa, redução de dano ou resistência, aplique somente o efeito explicitamente indicado na descrição.

## 1.4. Equipamentos e inventário
A ficha deve possuir:
- Arma principal.
- Arma secundária.
- Escudo.
- Armadura.
- Acessório.
- Itens mágicos equipados.
- Inventário geral.
- Quantidade de cada item.
- Peso ou espaço ocupado, opcional.
- Moedas de ouro.
- Botão ou ação para equipar, desequipar, usar ou descartar itens.

Cada arma deve possuir nome, categoria, dano, alcance, atributo utilizado e propriedades especiais.

Cada armadura deve possuir nome, bônus de defesa e penalidades de movimentação, quando aplicáveis.

Cada item mágico deve possuir nome, raridade, efeito, duração, requisito de uso e quantidade de utilizações, se houver.

## 1.5. Combate
A ficha deve apresentar:
- PV atuais e máximos.
- PE atuais e máximos.
- Defesa.
- Iniciativa.
- Armas equipadas.
- Habilidades disponíveis.
- Efeitos temporários.
- Condições negativas.
- Resistências e vulnerabilidades.
- Quantidade de poções e consumíveis.
- Histórico de dano recebido e cura, se suportado pelo VTT.

O combate deve utilizar uma ação principal por turno. O mestre pode permitir movimentação e uma interação simples com um item durante o mesmo turno.

Uma habilidade só pode ser utilizada se o personagem atender aos requisitos, possuir os recursos necessários e respeitar seu tempo de recarga, caso exista.

Quando os PV chegarem a zero, o personagem fica incapacitado. O mestre decide o que acontece após isso.

# 2. RAÇAS E PROGRESSÃO DE HABILIDADES

O jogador deve escolher uma raça. A raça determina atributos adicionais, benefícios, malefícios e quantas habilidades da classe podem ser selecionadas em cada nível.

As quantidades abaixo são limites de escolha de habilidades da classe, e não habilidades raciais gratuitas.

As habilidades escolhidas permanecem disponíveis após a evolução. Ao subir de nível, o personagem desbloqueia as novas escolhas sem perder as anteriores.

## 2.1. Humano — dificuldade extrema

**Progressão de habilidades:**
- Nível 1: escolher 2 habilidades de nível 1.
- Nível 2: escolher 1 habilidade de nível 2.
- Nível 3: escolher 1 habilidade de nível 3.

**Total:** 4 habilidades de classe.

**Benefício — Adaptabilidade:** uma vez por combate, o Humano pode repetir um teste de atributo que falhou, mas deve aceitar o novo resultado.

**Malefício — Mortalidade:** não possui resistência racial especial e não pode ignorar condições negativas por causa da raça.

**Atributos raciais:** +1 em um atributo à escolha, limitado ao máximo permitido pelo mestre.

O Humano deve ser a raça mais difícil de jogar. Sua baixa quantidade de habilidades exige decisões cuidadosas, e ele depende de posicionamento, equipamentos e escolhas inteligentes para competir com as outras raças.

## 2.2. Elfo — especialista arcano

**Progressão de habilidades:**
- Nível 1: escolher 2 habilidades de nível 1.
- Nível 2: escolher 2 habilidades de nível 2.
- Nível 3: escolher 2 habilidades de nível 3.

**Total:** 6 habilidades de classe.

**Benefício — Percepção Élfica:** vantagem em testes de percepção e identificação de magia. Uma vez por combate, reduz em 2 o dano mágico recebido antes das demais reduções.

**Malefício — Constituição Delicada:** sofre -2 em testes para resistir a venenos e doenças físicas.

**Atributos raciais:** +1 em AGI e -1 em VIG.

O Elfo deve ser eficiente com personagens que exigem precisão, magia ou habilidades avançadas, mas sua resistência física inferior deve exigir cautela.

## 2.3. Anão — resistência e consistência

**Progressão de habilidades:**
- Nível 1: escolher 4 habilidades de nível 1.
- Nível 2: escolher 1 habilidade de nível 2.
- Nível 3: escolher 1 habilidade de nível 3.

**Total:** 6 habilidades de classe.

**Benefício — Constituição Ancestral:** reduz em 2 o dano de venenos e possui vantagem em testes para resistir a empurrões, quedas e deslocamentos forçados.

**Malefício — Passos Curtos:** movimenta-se 1 unidade a menos que as outras raças em cada turno, respeitando o mínimo de 1 unidade.

**Atributos raciais:** +1 em VIG e -1 em AGI.

O Anão deve ter boa resistência e várias opções no começo, mas menor mobilidade e menos escolhas de habilidades avançadas.

## 2.4. Demônio — poder e risco

**Progressão de habilidades:**
- Nível 1: escolher 2 habilidades de nível 1.
- Nível 2: escolher 1 habilidade de nível 2.
- Nível 3: escolher 3 habilidades de nível 3.

**Total:** 6 habilidades de classe.

**Benefício — Essência Infernal:** uma vez por combate, converte parte do dano causado por um ataque próprio em cura. A cura é igual a 50% do dano efetivamente causado, limitada a 25% da vida máxima por ativação.

**Malefício — Fraqueza Sagrada:** recebe 50% de dano adicional de habilidades explicitamente sagradas e sofre penalidades em testes contra purificação divina.

**Atributos raciais:** +1 em FOR ou ESP e -1 em VIG.

O Demônio deve ter poucas opções no início e grande potencial no nível 3. O mestre deve garantir que os efeitos sagrados apareçam ocasionalmente, sem transformar toda a aventura em uma punição contra essa raça.

## 2.5. Mutante — adaptação e instabilidade

**Progressão de habilidades:**
- Nível 1: escolher 2 habilidades de nível 1.
- Nível 2: escolher 3 habilidades de nível 2.
- Nível 3: escolher 1 habilidade de nível 3.

**Total:** 6 habilidades de classe.

**Benefício — Adaptação Biológica:** escolhe uma mutação no início da aventura:
1. Garras: ataques desarmados causam +2 de dano.
2. Visão noturna: enxerga em ambientes escuros.
3. Pele resistente: reduz em 1 o dano físico recebido.
4. Membros alongados: aumenta o alcance de ataques corpo a corpo em 1 unidade.
5. Regeneração: recupera 1 PV ao final de um combate vencido, se estiver vivo.

Apenas uma mutação pode ser escolhida inicialmente.

**Malefício — Instabilidade Genética:** uma vez por combate, quando ficar abaixo de 25% da vida máxima, deve realizar um teste de VIG com dificuldade 12. Em caso de falha, sofre -2 no próximo teste de ataque ou atributo. A condição termina após a próxima ação.

**Atributos raciais:** +1 em VIG ou FOR e -1 em INT.

O Mutante deve se destacar no nível 2, adaptando-se a várias situações, mas ter um poder final mais limitado.

## 2.6. Descendente de Anjo — facilidade e poder divino

**Progressão de habilidades:**
- Nível 1: escolher 4 habilidades de nível 1.
- Nível 2: escolher 3 habilidades de nível 2.
- Nível 3: escolher 2 habilidades de nível 3.

**Total:** 9 habilidades de classe.

**Benefício — Graça Celestial:** uma vez por combate, recupera PV iguais a 2 + ESP ou concede a um aliado próximo uma proteção que absorve 3 pontos de dano.

**Malefício — Juramento Celestial:** se atacar deliberadamente um aliado incapacitado ou usar um item para prejudicar um inocente, perde a Graça Celestial até reparar a transgressão, conforme decisão do mestre.

**Atributos raciais:** +1 em ESP e +1 em VIG, mas -1 em FOR.

O Descendente de Anjo deve ser a raça mais fácil para iniciantes, com mais habilidades selecionadas e maior margem para experimentar combinações. A facilidade vem da versatilidade, não de imunidade a derrotas.

# 3. CLASSES E REGRAS DE ATRIBUTOS

O jogador escolhe uma classe. A classe define a vida-base, energia-base, atributo de ataque, estilo de combate, habilidades disponíveis e uma fraqueza exclusiva.

Os atributos de ataque e magia não devem ser somados duas vezes. Utilize apenas o atributo indicado pela habilidade.

## 3.1. Guerreiro

**Função:** combate físico, proteção e resistência.

- Vida-base: 18 PV.
- Energia-base: 4 PE.
- Ataque principal: FOR.
- Atributos recomendados: FOR e VIG.
- Fraqueza — Especialista em combate direto: sofre -2 em testes de ataque contra inimigos que estejam fora do alcance de sua arma. Não recebe bônus por simplesmente estar distante.

### Habilidades de nível 1
1. **Golpe Brutal:** causa dano da arma + 3. Custo: 1 PE.
2. **Guarda de Ferro:** reduz em 3 o próximo dano recebido. Custo: 1 PE.
3. **Investida:** avança até o inimigo e ataca com dano da arma + 1. Custo: 1 PE.
4. **Contra-ataque:** após bloquear ou esquivar com sucesso, realiza um ataque com dano da arma. Custo: 1 PE.
5. **Provocação:** um inimigo que falhar em um teste de ESP contra dificuldade 12 deve priorizar o Guerreiro em seu próximo ataque. Custo: 1 PE.

### Habilidades de nível 2
1. **Redemoinho de Aço:** atinge todos os inimigos adjacentes, causando dano da arma a cada um. Custo: 3 PE.
2. **Determinação:** durante 2 turnos, não pode ser derrubado nem atordoado. Custo: 3 PE.
3. **Quebra-Defesa:** causa dano da arma + 4 e ignora 2 pontos de defesa adicional. Custo: 3 PE.

### Habilidades de nível 3
1. **Último Bastião:** durante 2 turnos, reduz em 5 o dano recebido e em 2 o dano sofrido por aliados adjacentes. Custo: 5 PE.
2. **Execução:** causa dano da arma + 8 contra um alvo com menos de 25% de PV. Custo: 5 PE.
3. **Fúria de Guerra:** durante 3 turnos, recebe +3 de dano em ataques físicos, mas sofre -2 em Defesa. Custo: 5 PE.

## 3.2. Monge

**Função:** mobilidade, combos e combate desarmado.

- Vida-base: 14 PV.
- Energia-base: 8 PE.
- Ataque principal: AGI ou FOR, conforme a habilidade.
- Fraqueza — Disciplina corporal: quando estiver sob efeito de lentidão ou imobilização, não pode usar habilidades que exijam deslocamento.

### Habilidades de nível 1
1. **Punho Rápido:** dois golpes, cada um causando 2 + FOR de dano. Custo: 1 PE.
2. **Passo Fluido:** esquiva de um ataque com um teste de AGI e se reposiciona. Custo: 1 PE.
3. **Palma Atordoante:** causa 2 + FOR de dano; o alvo testa VIG contra dificuldade 12 para evitar perder sua próxima ação principal. Custo: 2 PE.
4. **Concentração Interior:** o próximo ataque desarmado causa +3 de dano. Custo: 1 PE.
5. **Varredura:** causa 3 + FOR de dano e derruba o alvo se ele falhar em VIG contra dificuldade 12. Custo: 1 PE.

### Habilidades de nível 2
1. **Oito Golpes Celestes:** realiza quatro golpes de 2 + FOR de dano contra o mesmo alvo. Custo: 3 PE.
2. **Corpo de Pedra:** reduz em 4 o dano físico recebido por 2 turnos. Custo: 3 PE.
3. **Salto do Dragão:** salta até um ponto visível e causa 5 + FOR de dano em uma pequena área. Custo: 3 PE.

### Habilidades de nível 3
1. **Punho do Vazio:** causa 8 + FOR de dano e ignora 3 pontos de defesa. Custo: 5 PE.
2. **Dança das Sombras:** realiza até três ataques de 3 + AGI de dano, podendo mudar de alvo entre os golpes. Custo: 5 PE.
3. **Espírito Indomável:** remove uma condição negativa e recupera 5 PV. Custo: 5 PE.

## 3.3. Clérigo

**Função:** cura, proteção e poder sagrado.

- Vida-base: 14 PV.
- Energia-base: 12 PE.
- Ataque mágico principal: ESP.
- Fraqueza — Dever sagrado: se utilizar deliberadamente uma habilidade para ferir um aliado inocente, perde acesso às habilidades sagradas até o final do próximo turno e deve reparar a situação conforme decisão do mestre.

### Habilidades de nível 1
1. **Toque Sagrado:** recupera 4 + ESP PV. Custo: 2 PE.
2. **Luz Purificadora:** causa 4 + ESP de dano mágico. Custo: 2 PE.
3. **Bênção Protetora:** concede redução de 3 no próximo dano recebido por um aliado. Custo: 2 PE.
4. **Selo de Repulsão:** causa 2 + ESP de dano e empurra inimigos adjacentes. Custo: 2 PE.
5. **Purificação:** remove uma condição simples, como veneno ou queimadura. Custo: 2 PE.

### Habilidades de nível 2
1. **Círculo de Cura:** recupera 4 + ESP PV de aliados em uma área pequena. Custo: 4 PE.
2. **Correntes Sagradas:** prende um alvo que falhar em VIG contra dificuldade 12 por 1 turno. Custo: 4 PE.
3. **Martelo Celestial:** causa 7 + ESP de dano mágico. Custo: 4 PE.

### Habilidades de nível 3
1. **Milagre Divino:** recupera 12 + ESP PV de um aliado. Custo: 6 PE.
2. **Santuário:** cria uma área que reduz em 4 o dano recebido pelos aliados durante 2 turnos. Custo: 6 PE.
3. **Ressurreição:** revive um aliado derrotado durante o combate com 25% de seus PV máximos. Custo: 8 PE. Uma vez por aventura.

## 3.4. Ladino

**Função:** furtividade, emboscadas e golpes precisos.

- Vida-base: 12 PV.
- Energia-base: 8 PE.
- Ataque principal: AGI.
- Fraqueza — Combate prolongado: depois de errar dois ataques consecutivos contra o mesmo alvo, sofre -2 no próximo ataque contra ele. O efeito termina após acertar ou mudar de alvo.

### Habilidades de nível 1
1. **Ataque Furtivo:** causa dano da arma + 4 se o alvo estiver distraído ou desprevenido. Custo: 1 PE.
2. **Passo Silencioso:** recebe vantagem em um teste de furtividade. Custo: 1 PE.
3. **Adaga Envenenada:** o próximo ataque causa +2 de dano e 2 de dano adicional no turno seguinte. Custo: 2 PE.
4. **Rolamento Evasivo:** tenta evitar um ataque com AGI e se reposiciona. Custo: 1 PE.
5. **Truque Sujo:** o alvo sofre -2 no próximo ataque se falhar em um teste de VIG contra dificuldade 12. Custo: 1 PE.

### Habilidades de nível 2
1. **Lâminas Gêmeas:** dois ataques com dano da arma + 2 cada. Custo: 3 PE.
2. **Bomba de Fumaça:** cria uma área que bloqueia a visão durante 2 turnos. Custo: 3 PE.
3. **Golpe Incapacitante:** causa dano da arma + 3 e reduz o movimento do alvo pela metade por 2 turnos. Custo: 3 PE.

### Habilidades de nível 3
1. **Morte Silenciosa:** causa dano da arma + 8 contra um alvo desprevenido. Contra alvos alertas, causa dano da arma + 4. Custo: 5 PE.
2. **Desaparecimento:** fica oculto até atacar ou sofrer dano direto. Custo: 5 PE.
3. **Dança das Adagas:** realiza um ataque contra até três inimigos próximos, causando dano da arma + 3 por acerto. Custo: 5 PE.

## 3.5. Arqueiro

**Função:** dano à distância, precisão e controle de área.

- Vida-base: 12 PV.
- Energia-base: 8 PE.
- Ataque principal: AGI.
- Fraqueza — Pressão próxima: sofre -2 em ataques com arco contra inimigos adjacentes.

### Habilidades de nível 1
1. **Tiro Preciso:** causa dano da arma + 3. Custo: 1 PE.
2. **Flecha Rasteira:** causa dano da arma e reduz o movimento do alvo pela metade por 1 turno. Custo: 1 PE.
3. **Recuo Tático:** recua e dispara uma flecha causando dano da arma. Custo: 1 PE.
4. **Armadilha de Caçador:** prende o primeiro inimigo que atravessar a área, se ele falhar em AGI contra dificuldade 12. Custo: 2 PE.
5. **Mira Firme:** prepara o próximo disparo, que causa +3 de dano. Custo: 1 PE.

### Habilidades de nível 2
1. **Chuva de Flechas:** causa dano da arma a todos os inimigos em uma área pequena. Custo: 3 PE.
2. **Flecha Perfurante:** causa dano da arma + 3 e pode atingir um segundo inimigo alinhado. Custo: 3 PE.
3. **Olho do Predador:** marca um inimigo; recebe +2 nos ataques contra ele durante 2 turnos. Custo: 3 PE.

### Habilidades de nível 3
1. **Flecha Devastadora:** causa dano da arma + 8 e ignora 2 pontos de defesa. Custo: 5 PE.
2. **Tempestade Celeste:** causa dano da arma + 2 a todos os inimigos em uma grande área. Custo: 5 PE.
3. **Caçada Implacável:** durante 3 turnos, cada acerto contra o alvo marcado aumenta em +2 o dano do próximo acerto, acumulando até +6. Custo: 5 PE.

## Descendente de Satã
Suporte sombrio
Dificuldade alta

Função: maldições, drenagem de vida, sacrifícios e enfraquecimento dos inimigos.

Atributo principal: ESP.

Vida-base: 14 PV.

Energia-base: 14 PE.

Estilo: transforma sofrimento em poder e pode ajudar os aliados por meios sombrios.

Malefício de classe — Pacto de Sangue
O Descendente de Satã não pode utilizar suas habilidades de cura gratuitamente.
- Sempre que uma habilidade exigir um sacrifício de vida, esse custo não pode ser reduzido por armaduras ou resistências.
- Se estiver com menos de 25% da vida máxima, não poderá utilizar habilidades que sacrifiquem PV.
- Ao ficar incapacitado, perde todos os efeitos de maldição que mantinha ativos.
Habilidades de nível 1
O jogador poderá escolher entre as cinco habilidades abaixo, respeitando o limite estabelecido pela raça.
1. Drenagem Profana

Causa 4 + ESP de dano mágico a um inimigo e recupera metade do dano efetivamente causado em PV, arredondada para baixo.

Custo: 3 PE · Alcance: médio

2. Maldição da Fraqueza

O alvo sofre -2 no dano de seus ataques durante 2 turnos.

Custo: 2 PE · Resistência: ESP contra dificuldade 12

3. Sacrifício Vital

Perde 3 PV e concede a um aliado um escudo que absorve até 6 pontos de dano.

Custo: 2 PE + 3 PV · Alcance: curto

4. Explosão Infernal

Causa 3 + ESP de dano mágico a todos os inimigos adjacentes.

Custo: 2 PE · Área: ao redor do personagem


5. Transferência de Agonia
Escolhe um aliado e remove uma condição negativa simples dele. O Descendente de Satã recebe 3 pontos de dano verdadeiro.

Custo: 2 PE · Não transfere efeitos permanentes

Habilidades de nível 2
- 6. Correntes do Inferno: prende um inimigo por 1 turno se ele falhar em VIG contra dificuldade 12. Custa 4 PE.
- 7. Pacto de Vitalidade: perde 5 PV para recuperar 10 PV de um aliado. Custa 3 PE.
- 8. Marca da Condenação: marca um inimigo por 3 turnos. A primeira vez que ele receber dano em cada turno, sofre mais 2 pontos de dano sombrio. Custa 4 PE.
Habilidades de nível 3

9. Banquete das Almas

Causa 8 + ESP de dano mágico a um inimigo. Recupera PV iguais à metade do dano efetivamente causado, arredondada para baixo.

Custo: 6 PE
10. Domínio Profano

Cria uma área sombria durante 2 turnos. Os inimigos dentro dela sofrem -2 em testes de ataque, enquanto os aliados recebem redução de 3 no primeiro dano sofrido em cada turno.

Custo: 7 PE
11. Avatar da Ruína

Sacrifica 25% dos PV atuais para assumir uma forma infernal por 3 turnos. Enquanto durar, recebe +3 de dano mágico e recupera 2 PV sempre que derrotar um inimigo.
Custo: 6 PE + 25% dos PV atuais

# 4. MAGIA E RACIOCÍNIO AVANÇADO

O Mago e o Feiticeiro devem ser as classes mais difíceis de dominar. Não basta escolher a habilidade de maior dano: é necessário administrar energia, posicionamento, preparação e consequências.

As duas classes possuem mecânicas distintas e não devem ser tratadas como equivalentes.

## 4.1. Mago — estratégia e preparação

**Função:** manipulação de elementos, controle de área, proteção e combinações arcanas.

- Vida-base: 10 PV.
- Energia-base: 16 PE.
- Atributo mágico: INT.
- Fraqueza — Fragilidade arcana: se for atingido enquanto estiver preparando uma magia avançada, deve passar em um teste de INT contra dificuldade 12. Se falhar, perde a preparação e metade da energia gasta nela, arredondada para cima.

### Sistema de preparação

Crie um campo específico chamado **Preparação Arcana**.

O Mago pode combinar elementos e efeitos para modificar suas magias:

- Fogo: dano adicional e queimadura.
- Gelo: redução de movimento.
- Eletricidade: possibilidade de atingir alvos próximos.
- Arcano: maior precisão ou penetração de defesa.
- Espaço: empurrar, puxar ou reposicionar alvos.

Cada preparação exige uma ação principal e custa 2 PE. Na ação seguinte, o Mago pode lançar uma magia básica com o elemento preparado, acrescentando o efeito correspondente. A preparação não pode ser acumulada consigo mesma.

Uma magia preparada pode ser interrompida conforme a fraqueza da classe.

### Habilidades de nível 1
1. **Projétil Arcano:** causa 4 + INT de dano mágico. Custo: 2 PE.
2. **Chama Viva:** causa 3 + INT de dano e 2 de queimadura no turno seguinte. Custo: 2 PE.
3. **Barreira Mística:** absorve 4 + INT de dano. Custo: 2 PE.
4. **Rajada Gélida:** causa 3 + INT de dano e reduz o movimento pela metade por 1 turno. Custo: 2 PE.
5. **Passo Arcano:** teletransporta-se por uma curta distância visível. Custo: 2 PE.

### Habilidades de nível 2
1. **Raio Encadeado:** causa 5 + INT de dano ao primeiro alvo e 3 + INT aos outros dois alvos próximos, se houver. Custo: 4 PE.
2. **Prisão de Cristal:** imobiliza um alvo por 1 turno se ele falhar em VIG contra dificuldade 12. Custo: 4 PE.
3. **Meteoro Menor:** causa 6 + INT de dano em uma pequena área. Custo: 4 PE.

### Habilidades de nível 3
1. **Singularidade Arcana:** puxa inimigos próximos para um ponto central e causa 5 + INT de dano. Custo: 7 PE.
2. **Tempestade Elemental:** causa 8 + INT de dano em uma grande área e aplica um efeito elemental previamente escolhido. Custo: 8 PE.
3. **Dobra da Realidade:** reposiciona um alvo voluntário ou inimigo em um ponto visível. Um inimigo pode resistir com VIG contra dificuldade 15. Custo: 7 PE.

### Regra de combinações inteligentes

Se o Mago combinar uma preparação com uma habilidade compatível, recebe um benefício definido pelo elemento e pela habilidade. Por exemplo:

- Gelo + Prisão de Cristal: se o alvo falhar na resistência, fica imobilizado por mais 1 turno. O custo da magia aumenta em 2 PE.
- Eletricidade + Raio Encadeado: o raio pode atingir um quarto alvo, se estiver próximo. O custo aumenta em 2 PE.
- Espaço + Meteoro Menor: o Mago pode deslocar levemente os alvos antes do impacto, desde que estejam dentro da área. O custo aumenta em 2 PE.

O mestre deve aprovar combinações não listadas. Nenhuma combinação pode duplicar o dano indefinidamente ou eliminar a necessidade de testes de resistência.

O Mago deve ser recompensado por pensar antes de agir, não por simplesmente acumular modificadores.

## 4.2. Feiticeiro — poder instável e risco calculado

**Função:** magia inata, corrupção, explosões e manipulação de energia sobrenatural.

- Vida-base: 12 PV.
- Energia-base: 14 PE.
- Atributo mágico: ESP.
- Fraqueza — Instabilidade: sempre que utilizar uma habilidade de nível 3, deve fazer um teste de controle com 1d20 + ESP contra dificuldade 12. Em caso de falha, sofre uma consequência de sobrecarga depois de resolver a habilidade.

### Sistema de sobrecarga

Crie um marcador de **Instabilidade**, que começa em zero e aumenta em 1 sempre que o Feiticeiro falhar no teste de controle.

- Com 1 ponto: -1 no próximo teste de controle.
- Com 2 pontos: perde 2 PE adicionais ao utilizar a próxima habilidade.
- Com 3 pontos: sofre 4 de dano verdadeiro e zera a Instabilidade.

O dano verdadeiro ignora armaduras e reduções comuns de dano. A Instabilidade também volta a zero após um descanso seguro, conforme decisão do mestre.

O Feiticeiro pode escolher assumir um risco maior: antes de lançar uma habilidade, pode adicionar até 3 pontos de Instabilidade voluntariamente. Cada ponto acrescenta +2 ao dano da habilidade, mas também aumenta em 2 a dificuldade do teste de controle. A escolha deve ser feita antes da rolagem.

### Habilidades de nível 1
1. **Orbe Caótico:** causa 4 + ESP de dano mágico. Custo: 2 PE.
2. **Maldição Enfraquecedora:** reduz em 2 o dano causado pelo alvo durante 2 turnos. Custo: 2 PE.
3. **Drenagem Vital:** causa 3 + ESP de dano e recupera PV iguais à metade do dano efetivamente causado, arredondada para baixo. Custo: 3 PE.
4. **Explosão Sombria:** causa 3 + ESP de dano a inimigos adjacentes. Custo: 2 PE.
5. **Sobrecarga Mágica:** a próxima habilidade ofensiva causa +3 de dano, mas o Feiticeiro sofre -2 em Defesa até seu próximo turno. Custo: 2 PE.

### Habilidades de nível 2
1. **Corrupção Arcana:** causa 3 + ESP de dano imediato e 3 de dano no turno seguinte. Custo: 4 PE.
2. **Mãos do Abismo:** prende um alvo por 1 turno se ele falhar em VIG contra dificuldade 12. Custo: 4 PE.
3. **Transfusão de Poder:** perde 3 PV e aumenta em +5 o dano da próxima habilidade ofensiva. Custo: 3 PE. Não pode ser usada se o personagem estiver com 3 PV ou menos.

### Habilidades de nível 3
1. **Forma Abissal:** durante 3 turnos, recebe +3 de dano mágico e reduz em 2 o dano recebido. Custo: 7 PE.
2. **Ruína Caótica:** causa 8 + ESP de dano em uma grande área. Antes do uso, o jogador escolhe entre dano adicional ou maior alcance; a dificuldade do teste de controle aumenta em 2. Custo: 8 PE.
3. **Pacto da Última Chama:** perde 25% dos PV atuais e causa 12 + ESP de dano mágico a um alvo. O custo é 0 PE, mas exige um teste de controle contra dificuldade 15. Em caso de falha, fica incapacitado após resolver o efeito. Não pode ser usado se o personagem tiver menos de 25% dos PV máximos.

O Feiticeiro deve ter o maior potencial de explosão de poder, mas também ser capaz de derrotar a si próprio se administrar mal os riscos.

# 5. ARMAS, ARMADURAS E ITENS MÁGICOS

A ficha deve permitir ao mestre cadastrar novos equipamentos sem precisar alterar a estrutura principal.

## Armas iniciais sugeridas
- Adaga: dano 3, leve, alcance corpo a corpo.
- Espada: dano 5, corpo a corpo.
- Machado pesado: dano 7, corpo a corpo, exige FOR 3.
- Cajado arcano: dano 2, pode conceder +1 em testes de ataque mágico quando equipado.
- Arco: dano 4, alcance à distância.
- Manoplas: dano 3, ataques desarmados.
- Martelo sagrado: dano 4, pode servir de foco para o Clérigo.

## Armaduras iniciais sugeridas
- Sem armadura: +0 Defesa.
- Armadura leve: +1 Defesa.
- Armadura média: +2 Defesa e -1 em testes de furtividade.
- Armadura pesada: +3 Defesa, -2 em AGI para testes de mobilidade e furtividade.

Os bônus de armadura devem ser aplicados automaticamente à Defesa. Não permita que bônus de várias armaduras sejam somados simultaneamente.

## Itens mágicos iniciais sugeridos
1. **Anel Vital:** aumenta a vida máxima em 3 PV.
2. **Amuleto Arcano:** aumenta a energia máxima em 3 PE.
3. **Botas do Vento:** aumentam o deslocamento em 1 unidade.
4. **Poção de Cura:** recupera 6 PV e é consumida ao uso.
5. **Poção de Energia:** recupera 5 PE e é consumida ao uso.
6. **Cristal Elemental:** permite adicionar um elemento compatível a uma habilidade mágica uma vez por combate, se o mestre aprovar.

O mestre deve poder alterar o efeito, a raridade e os requisitos de todos os itens.

# 6. PROGRESSÃO, DESCANSO E RECURSOS

- O personagem começa no nível 1.
- O mestre define quando a experiência permite subir de nível.
- Ao subir de nível, o personagem recebe as escolhas de habilidades previstas pela raça.
- Ao subir de nível, o personagem recebe +2 PV máximos e +1 PE máximo.
- O aumento de PV e PE máximos não deve restaurar automaticamente os recursos atuais.
- Um descanso curto recupera 25% dos PE máximos.
- Um descanso seguro recupera todos os PV e PE.
- O mestre pode conceder experiência por combate, exploração, interpretação e conclusão de objetivos.

A ficha deve mostrar claramente as habilidades disponíveis, as já escolhidas e as ainda bloqueadas.

# 7. INTERFACE E FUNCIONALIDADES DA FICHA

Organize a interface em abas:

1. **Resumo:** nome, raça, classe, nível, PV, PE e Defesa.
2. **Atributos:** FOR, AGI, INT, ESP e VIG.
3. **Habilidades:** habilidades de níveis 1, 2 e 3, com filtros e descrição completa.
4. **Combate:** armas, ataque, dano, iniciativa e condições.
5. **Magias:** recursos, preparação arcana do Mago e Instabilidade do Feiticeiro.
6. **Equipamentos:** armas, armaduras e itens equipados.
7. **Inventário:** itens, quantidades, moedas e consumíveis.
8. **Progressão:** experiência, nível e escolhas pendentes.
9. **Anotações:** missão, história e observações do mestre.

Cada habilidade deve mostrar:
- Nome.
- Nível exigido.
- Descrição.
- Custo de PE.
- Dano ou cura.
- Alcance.
- Duração.
- Tempo de recarga, se houver.
- Condições especiais.
- Botão para utilizar, quando o VTT suportar essa funcionalidade.

O botão de utilização deve verificar requisitos, descontar PE, aplicar efeitos e atualizar os recursos da ficha. Se a plataforma não permitir automatizar o efeito, exiba os dados necessários para o mestre resolver a ação manualmente.

# 8. REGRAS GERAIS DE CONSISTÊNCIA

- Não permitir selecionar habilidades de uma classe diferente da escolhida.
- Não permitir ultrapassar o limite de habilidades determinado pela raça.
- Não permitir utilizar habilidades de nível superior antes de alcançar o nível correspondente.
- Não permitir utilizar habilidades sem recursos suficientes.
- Não permitir equipar duas armaduras simultaneamente.
- Não permitir que os recursos atuais ultrapassem seus valores máximos.
- Permitir ao mestre modificar atributos, recursos, habilidades, itens e regras.
- Exibir claramente os benefícios e malefícios raciais e de classe.
- Não aplicar automaticamente um efeito que dependa de uma decisão do mestre.
- Manter a ficha legível e rápida de consultar durante o combate.

# RESULTADO ESPERADO

Entregue uma ficha completa e pronta para ser configurada no Virtual Tabletop, com todos os campos, listas de opções, regras de progressão, habilidades, fórmulas, armas, armaduras, itens mágicos, inventário e recursos especiais.

Priorize simplicidade de uso, clareza e consistência das regras. Não crie novas raças ou classes além das especificadas. O mestre deve conseguir personalizar o sistema sem perder a estrutura básica.