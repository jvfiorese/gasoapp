// Testes do leitor de laudo (textos sintéticos no formato típico de cada aparelho; trocar por laudos reais quando chegarem).
const { lerLaudo } = require("../src/leitor.js");
let falhas = 0;
function caso(nome, texto, esperado) {
  const r = lerLaudo(texto);
  const erros = Object.entries(esperado).filter(([k, v]) => r.valores[k] !== v).map(([k, v]) => `${k}: ${r.valores[k]} ≠ ${v}`);
  if (erros.length) falhas++;
  console.log(`${erros.length ? "FALHA" : "OK  "} ${nome}${erros.length ? "\n      " + erros.join("; ") : ""}${r.notas.length ? "\n      notas: " + r.notas.join(" | ") : ""}`);
}
caso("Radiometer ABL (mmHg, 37 °C + T)", `ABL800 FLEX
Valores de gasometria
pH 7,312
pCO2 52,1 mmHg
pO2 88,0 mmHg
pH(T) 7,320
pCO2(T) 50,8 mmHg
Valores de eletrólitos
cK+ 4,8 mmol/L
cNa+ 138 mmol/L
cCa2+ 1,12 mmol/L
cCl- 104 mmol/L
Valores de metabólitos
cGlu 142 mg/dL
cLac 2,4 mmol/L
Status de oxigenação
ctHb 11,2 g/dL
sO2 96,1 %
Status ácido-base
cBase(B)c -0,9 mmol/L
cBase(Ecf)c -1,2 mmol/L
cHCO3-(P,st)c 22,9 mmol/L
cHCO3-(P)c 25,6 mmol/L
FO2(I) 50,0 %`, { pH: 7.312, pco2: 52.1, pao2: 88, k: 4.8, na: 138, cai: 1.12, cl: 104, glic: 142, lact: 2.4, be: -1.2, hco3: 25.6, fio2: 50 });
caso("Siemens RAPIDPoint (kPa, colunas)", `RAPIDPoint 500
pH 7.28
pCO2 7.20 kPa
pO2 12.5 kPa
Na+ 140 mmol/L
K+ 5.6 mmol/L
Cl- 106 mmol/L
Ca++ 1.05 mmol/L
Glu 7.8 mmol/L
Lac 3.1 mmol/L
HCO3act 24.8 mmol/L
HCO3std 23.1 mmol/L
BE(ecf) -2.5 mmol/L
BE(B) -2.1 mmol/L`, { pH: 7.28, pco2: 54, pao2: 94, na: 140, k: 5.6, cl: 106, cai: 1.05, glic: 140, lact: 3.1, hco3: 24.8, be: -2.5 });
caso("Texto ao Vivo com valor na linha de baixo", `pH
7,35
pCO2
41
HCO3-
22,1
BE
-2,8`, { pH: 7.35, pco2: 41, hco3: 22.1, be: -2.8 });
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram"); process.exit(falhas ? 1 : 0);
