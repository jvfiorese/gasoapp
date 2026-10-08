# Auditoria do Gasoapp (v0.2 → v0.3), 08/10/2026

## Resumo

As contas básicas da v0.2 estavam certas: pH por Henderson, BE estimado, ânion gap, AG corrigido pela albumina, Winter, P/F e SIDa/SIDe/SIG bateram com a calculadora de referência em todos os casos. O que estava errado eram **fórmulas que não seguiam a fonte citada**, **dois chips de contexto que não faziam o que prometiam**, **um erro perigoso no leitor de laudo** e **duas condutas desatualizadas pela ERC 2025**. Tudo foi corrigido na v0.3.

## Como foi conferido

1. Cada fórmula e cada dose foram comparadas com o artigo ou a diretriz original.
2. Escrevi uma **calculadora de referência separada** (em Python, sem aproveitar o código do app), direto das fórmulas publicadas. Ela foi comparada com o motor do app em **2.593 gasometrias aleatórias** fisiologicamente coerentes (pH gerado por Henderson-Hasselbalch a partir de PaCO₂ e HCO₃⁻, com eletrólitos, albumina, lactato, PaO₂ e FiO₂ variados): 36.769 comparações.
   - v0.2: divergências em 10 itens (detalhes abaixo), 344 casos com classificação diferente.
   - v0.3: **todas as 36.769 comparações batem**.
3. Escrevi **21 casos de auditoria** com valores calculados à mão (`testes/auditoria.test.js`). Os 16 casos antigos e os 3 do leitor continuam passando.

## Erros encontrados e corrigidos

| # | Onde | v0.2 (errado) | v0.3 (correto) | Fonte |
|---|---|---|---|---|
| 1 | Stewart simplificado: efeito Na⁺−Cl⁻ | Na − Cl − **38** (constante do Story 2004) | Na − Cl − **35** | Story, Anesth Analg 2016 |
| 2 | Stewart simplificado: efeito do lactato | **−lactato** | **1 − lactato** | Story 2016 |
| 3 | Consequência de 1 e 2 | "Outros ânions" ficava ~4 mEq/L mais alcalino que o real | Correto | Story 2016 |
| 4 | Alcalose metabólica: PaCO₂ esperada | 40 + 0,7 × ΔHCO₃⁻ **± 5** | **± 2** | Berend, NEJM 2014, tabela 1 |
| 5 | Acidose respiratória crônica | HCO₃⁻ +**3,5** por 10 mmHg | +**4 a 5** por 10 mmHg | Berend 2014 |
| 6 | Alcalose respiratória crônica | HCO₃⁻ −**4** por 10 mmHg | −**4 a 5** por 10 mmHg | Berend 2014 |
| 7 | Chip "DPOC / hipercapnia crônica" | Não ativava a compensação crônica: um DPOC compensado saía como "alcalose metabólica associada" | Ativa a compensação crônica | Berend 2014 |
| 8 | Delta-delta com distúrbio respiratório primário | Usava sempre 24 como HCO₃⁻ basal: hipercapnia crônica + AG alto saía como "alcalose metabólica" falsa | Usa o HCO₃⁻ esperado pela compensação | Rastegar, JASN 2007 |
| 9 | Gradiente A–a | Equação simplificada (PaCO₂/0,8): A–a superestimado em até 10 mmHg com FiO₂ 1,0 | Equação completa do gás alveolar | Fisiologia padrão |
| 10 | "A–a esperado = idade/4 + 4" | Mostrado com qualquer FiO₂ | Só em ar ambiente (FiO₂ ≤ 0,25), onde vale | — |
| 11 | pH 7,34 com PaCO₂ 44 e HCO₃⁻ 23 | "Sem distúrbio ácido-base" | Identifica o distúrbio pela direção em relação a 40 / 24 | Berend 2014 |
| 12 | Valores incoerentes (pH × PaCO₂ × HCO₃⁻) | Só um aviso discreto; o resumo dizia "sem distúrbio" | O resumo começa com "Valores incoerentes: confira antes de usar" | — |
| 13 | **Leitor de laudo: glicose** | Qualquer glicose < 35 era tratada como mmol/L e multiplicada por 18: "Glu 30" virava **540 mg/dL** | Converte só com "mmol/L" escrito; sem unidade e < 35, não preenche e avisa | — |
| 14 | Unidades trocadas na digitação | Albumina em g/L (ex.: 35) gerava AG corrigido absurdo | Albumina > 10 é convertida de g/L com aviso; Ca²⁺ > 3 convertido de mg/dL; aviso para lactato > 15 (mg/dL?) e Mg < 1 (mmol/L?) | — |
| 15 | Chip "Sepse / choque" | Não fazia nada | Coloca a acidose lática tipo A em primeiro | SSC 2021 |
| 16 | Ordem dos grupos de hipóteses | Respiratório sempre primeiro, mesmo quando o primário era metabólico | O grupo do distúrbio primário abre primeiro | — |

## Condutas conferidas

| Conduta | Situação | Fonte |
|---|---|---|
| Hipercalemia: cálcio, insulina 10 UI + glicose 25 g, glicose 10% 50 mL/h por 5 h se glicemia < 126, monitorização, salbutamol 10–20 mg, ciclossilicato 10 g 8/8 h | Correto | UKKA 2023 (algoritmo hospitalar) |
| Hipercalemia **na parada** | **Acrescentado**: cloreto de cálcio 10% 10 mL + bicarbonato de sódio 50 mmol | ERC 2025 |
| Hipocalemia **na parada** | **Corrigido**: era 2 mmol/min por 10 min (ERC 2021); agora KCl 20 mmol em 2–3 min + 10 mmol em 2 min | ERC 2025 |
| Hipocalemia sem parada (10 mmol/h periférica, até 20 mmol/h central), MgSO₄ 2 g = 8 mmol | Correto | — |
| Hipertermia maligna: dantrolene 2–2,5 mg/kg pelo peso real, máx. 300 mg/dose, a cada 10 min; resfriar até < 38,5 °C; bicarbonato se pH < 7,2 | Correto; **acrescentado** o critério de parada (PaCO₂ < 45 mmHg com ventilação minuto normal e temperatura caindo) | EMHG 2024 |
| CAD: cristaloide 500–1.000 mL/h, insulina 0,1 UI/kg/h, K⁺ < 3,5 adia insulina, 10–20 mmol/L de KCl se 3,5–5, glicose quando < 250, bicarbonato só se pH < 7,0 | Correto | ADA/EASD 2024 |
| Bicarbonato na LRA: 4,2% 125–250 mL em 30 min, alvo pH ≥ 7,30, máx. 1 L/24 h; menos diálise, sem efeito na mortalidade (BICARICU-2: 62,1% vs 61,7%) | Correto; **acrescentados** os critérios do ensaio (HCO₃⁻ ≤ 20 e PaCO₂ ≤ 45) | BICAR-ICU 2018, BICARICU-2 2025 |
| Hiponatremia grave: NaCl 3% 150 mL em 20 min, até 2×, até +5 mmol/L; limite de 10 mmol/L em 24 h | Correto | ESE/ESICM/ERBP 2014 |
| Hipocalcemia: CaCl₂ 10% 10 mL ou gluconato 10% 30 mL (≈ 6,8 mmol); Ca²⁺ iônico normal na transfusão maciça | Correto | Diretriz europeia de trauma 2023 |
| Hipoglicemia (10–25 g de glicose), alvo glicêmico perioperatório 100–180 mg/dL | Correto | ADA 2025 |
| Sepse: 30 mL/kg em 3 h (fraca), PAM ≥ 65, noradrenalina 1ª linha | Correto | SSC 2021 |
| Hidroxocobalamina 5 g IV em 15 min (cianeto) | Correto | — |

## Fórmulas que ficaram como estavam (conferidas)

- H⁺ = 24 × PaCO₂ / HCO₃⁻ (Kassirer-Bleich); tolerância de 0,04 de pH para incoerência.
- SBE = 0,93 × (HCO₃⁻ − 24,4 + 14,83 × (pH − 7,4)) (Van Slyke, CLSI).
- Winter: PaCO₂ = 1,5 × HCO₃⁻ + 8 ± 2.
- Respiratória aguda: +1 (acidose) e −2 (alcalose) por 10 mmHg, ± 2.
- AG = Na⁺ − (Cl⁻ + HCO₃⁻); AG corrigido = AG + 2,5 × (4,0 − albumina) (Figge 1998).
- SIDa, SIDe (Figge-Fencl) e SIG; conversões de Mg (÷ 2,43) e fosfato (÷ 3,1).

## Limites que continuam valendo

- **AG normal = 12** é uma convenção. Berend lembra que a faixa normal vai de 3–12 até 8,5–15 conforme o aparelho; se o laboratório do João usa outra referência, vale ajustar.
- **SIG não tem faixa normal padronizada**: com valores laboratoriais normais estas equações dão cerca de 3 a 5. O rótulo "normal 0–2" foi retirado.
- **Pressão barométrica** fixa em 760 mmHg no A–a. Em altitude, o A–a sai superestimado.
- O leitor de laudo ainda usa textos sintéticos; precisa dos laudos reais para calibrar.

## Como repetir a auditoria

```
node fonte/testes/casos.test.js
node fonte/testes/auditoria.test.js
node fonte/testes/leitor.test.js
sh fonte/testes/referencia/rodar.sh
```
