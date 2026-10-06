# Gasoapp — proposta v1 (fontes + estrutura)

*Rascunho para discussão. 05/10/2026.*

## 1. Formato escolhido (default, pode mudar)

- **PWA em um único arquivo HTML**, aberto no Safari e salvo com "Compartilhar → Adicionar à Tela de Início". Abre em tela cheia, como app, e funciona **offline**.
- Toda a lógica fica no próprio arquivo. **Nenhum dado de paciente sai do iPhone**, sem login, sem servidor.
- Hospedagem só para baixar o arquivo uma vez (ex.: link de Artifact ou GitHub Pages privado); depois roda sem internet.

## 2. Fontes propostas

Classifiquei em três níveis: **N1** = base do algoritmo de interpretação; **N2** = guideline que dita conduta; **N3** = referência de apoio/livro.

### 2.1 Interpretação ácido-base (motor do app)

| Nível | Fonte | Uso no app |
|---|---|---|
| N1 | Berend K, de Vries APJ, Gans ROB. *Physiological approach to assessment of acid–base disturbances*. NEJM 2014;371:1434-45 | Sequência de passos (pH → primário → compensação → AG → delta) |
| N1 | Kraut JA, Madias NE. *Metabolic acidosis: pathophysiology, diagnosis and management*. Nat Rev Nephrol 2010;6:274-85 | Diferenciais de acidose AG alto/normal |
| N1 | Seifter JL. *Integration of acid–base and electrolyte disorders*. NEJM 2014;371:1821-31 | Distúrbios mistos, ligação com eletrólitos |
| N1 | Figge J et al. *Anion gap and hypoalbuminemia*. Crit Care Med 1998;26:1807-10 | Correção do AG pela albumina |
| N1 | Rastegar A. *Use of the ΔAG/ΔHCO3⁻ ratio in the diagnosis of mixed acid-base disorders*. JASN 2007;18:2429-31 | Delta-delta |
| N1 | Fórmulas de compensação (Winter; Albert/Dell/Winters 1967; regras de Boston, Narins & Emmett 1980) | Compensação esperada |
| N2 | Kraut JA, Madias NE. *Lactic acidosis*. NEJM 2014;371:2309-19 | Tipos A/B de lactato e conduta |
| N3 | Story DA. *Stewart acid-base: a simplified bedside approach*. Anesth Analg 2016;123:511-5 | Módulo opcional Stewart (SID, efeito do cloro/albumina), útil no intraop |
| N3 | Kellum JA. *Determinants of blood pH in health and disease*. Crit Care 2000 | Base do Stewart |

### 2.2 Conduta (nefrologia / terapia intensiva)

| Nível | Fonte | Tema |
|---|---|---|
| N2 | Jaber S et al. **BICAR-ICU**. Lancet 2018;392:31-40 | Bicarbonato na acidose metabólica grave (pH ≤ 7,20), benefício em LRA |
| N2 | Umpierrez GE et al. *Hyperglycemic crises in adults with diabetes: consensus report* (ADA/EASD/JBDS/AACE/DTS). Diabetes Care 2024 | CAD/EHH |
| N2 | Evans L et al. **Surviving Sepsis Campaign 2021** | Lactato, fluidos, vasopressor |
| N2 | KDIGO **AKI** 2012 (+ atualização em curso) | LRA, indicação de diálise por acidose/K⁺ |
| N2 | Spasovski G et al. ESE/ESICM/ERBP *Hyponatraemia guideline* 2014 | Na⁺ (se a gasometria trouxer eletrólitos) |
| N2 | Lott C et al. **ERC 2021** *Cardiac arrest in special circumstances* | Hipercalemia/hipocalemia graves |
| N2 | UK Kidney Association. *Treatment of acute hyperkalaemia in adults* (2020/2023) | Algoritmo de hipercalemia |
| N2 | Semler MW **SMART** NEJM 2018; Zampieri **BaSICS** JAMA 2021; Finfer **PLUS** NEJM 2022 | Acidose hiperclorêmica e escolha do cristaloide |

### 2.3 Conduta (anestesia / ventilação / oxigenação)

| Nível | Fonte | Tema |
|---|---|---|
| N2 | **MHAUS** *Emergency therapy for malignant hyperthermia* + Hopkins PM et al. EMHG 2021 (BJA) | Hipercapnia + acidose mista inexplicada no intraop |
| N2 | ARDS Network NEJM 2000 + Grasselli G et al. **ESICM ARDS guideline 2023** | Hipercapnia permissiva, PaO₂/FiO₂, ventilação protetora |
| N2 | O'Driscoll BR et al. **BTS oxygen guideline** 2017 | Alvos de SpO₂/PaO₂, hiperóxia |
| N2 | Rochwerg B et al. ERS/ATS *Noninvasive ventilation* 2017 | Acidose respiratória aguda (DPOC) |
| N3 | Miller's Anesthesia, 10ª ed., cap. de ácido-base e fluidos; Morgan & Mikhail 7ª ed. | Causas intraoperatórias (CO₂ do pneumoperitônio, hipoventilação, SF 0,9% em volume, torniquete, clampeamento) |
| N3 | Hall JE. Guyton; West's Respiratory Physiology | Gradiente A-a, PAO₂ |

Observação: as referências acima são as que considero padrão; antes de virar texto do app, cada conduta será conferida na fonte original (dose, limiar, ano da versão). Se você tiver preferência por diretrizes brasileiras (AMIB, SBN, SBA), entram como N2 lado a lado.

## 3. Como o app vai ler a gasometria

**Entrada** (tela única, teclado numérico, campos opcionais acinzentados):
- Obrigatórios: pH, PaCO₂, HCO₃⁻
- Recomendados: Na⁺, K⁺, Cl⁻, albumina, lactato, glicose, BE
- Oxigenação: PaO₂, FiO₂ (e opcional Patm/PEEP)
- Contexto (toques rápidos): intraoperatório / UTI / PS; cronicidade suspeita (agudo/crônico); DPOC; DRC; diabetes; ventilado sim/não; pneumoperitônio sim/não

**Motor (determinístico, regras explícitas, sem IA):**
1. Coerência interna (Henderson-Hasselbalch: H⁺ = 24·PaCO₂/HCO₃⁻) → alerta de amostra/erro de digitação
2. Acidemia/alcalemia
3. Distúrbio primário
4. Compensação esperada (Winter; regras agudo/crônico) → identifica distúrbio misto
5. Ânion gap corrigido pela albumina → se alto, delta-delta (acidose normo-AG ou alcalose metabólica associada)
6. Se AG normal: Cl⁻, sugere AG urinário (texto)
7. Oxigenação: P/F, PAO₂ e gradiente A-a esperado para idade, classificação de Berlim quando aplicável
8. Eletrólitos: K⁺, Na⁺, glicose, lactato com faixas de gravidade
9. (Opcional) Stewart: SIDa, SIG

**Saída** (em cartões, do mais urgente para o menos):
- 🔴 **Alertas críticos** primeiro (K⁺ > 6,5, pH < 7,1, lactato > 4, PaO₂ < 60...), com conduta imediata
- **Diagnóstico** em uma frase (ex.: "Acidose metabólica AG alto + alcalose metabólica associada, compensação respiratória adequada")
- **Hipóteses** ordenadas pelo contexto (no intraop sobem: hipoventilação, absorção de CO₂, hiperclorêmica por SF, hipoperfusão, HM), cada uma com "o que reforça / o que afasta"
- **Conduta imediata** por hipótese, com doses, e a **fonte** clicável embaixo de cada item
- Botão "mostrar cálculos" para ver todas as contas

**Extras possíveis:** comparar com gasometria anterior (tendência), histórico só no aparelho, modo escuro para sala cirúrgica.

## 4. Segurança

- Aviso fixo: ferramenta de apoio, não substitui julgamento clínico.
- Cada regra no código cita sua fonte; uma tabela de casos de teste (gasometrias de livro e publicadas) valida o motor antes de cada versão.
- Nada é enviado para fora do aparelho.

## 5. Plano

1. Você valida fontes e escopo (ver perguntas abaixo).
2. Eu escrevo o motor + casos de teste e um protótipo de tela.
3. Você testa no iPhone com gasometrias reais (sem identificação).
4. Iteramos condutas, fonte por fonte.

## 6. Perguntas para você

1. Foco inicial só **intraoperatório** ou também UTI/PS? (sugiro começar intraop + UTI)
2. Incluir **Stewart** já na v1 ou só a abordagem tradicional? (sugiro tradicional, Stewart como aba extra)
3. Quer **diretrizes brasileiras** junto das internacionais?
4. Condutas com **doses** explícitas (ex.: gluconato de cálcio 10% 30 mL) ou só a orientação? (sugiro com doses)
