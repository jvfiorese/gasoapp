// Casos da auditoria de 2026-10-08: valores calculados à mão a partir das fontes originais.
// Rodar: node testes/auditoria.test.js
const { analisar } = require("../src/motor.js");
const { lerLaudo } = require("../src/leitor.js");
let falhas = 0;
const ids = (r) => r.disturbios.map((d) => d.id).sort().join(",");
const calc = (r, nome) => (r.calculos.find((c) => c.nome.startsWith(nome)) || {}).valor;
function ok(nome, cond, detalhe = "") { if (!cond) falhas++; console.log(`${cond ? "OK  " : "FALHA"} ${nome}${cond ? "" : "\n      " + detalhe}`); }

// Cetoacidose pura: AG 30, Δ/Δ = 18/18 = 1; Winter 1,5×6+8 = 17 ± 2 (Berend 2014; Winters 1967)
let r = analisar({ pH: 7.16, pco2: 17, hco3: 6, na: 135, cl: 99, alb: 4 });
ok("CAD: acidose AG alto pura, Winter 15–19, Δ/Δ 1", ids(r) === "acid_met" && calc(r, "PaCO₂ esperada (Winter)") === "15–19" && calc(r, "Delta-delta") === 1, `${ids(r)} ${JSON.stringify(r.calculos)}`);

// DPOC marcado: compensação crônica 4–5 por 10 mmHg (Berend 2014) → HCO3 30–36 com PaCO2 60
r = analisar({ pH: 7.36, pco2: 60, hco3: 32, ctx: { dpoc: true } });
ok("DPOC: o chip DPOC usa compensação crônica (sem alcalose metabólica falsa)", ids(r) === "acid_resp" && calc(r, "HCO₃⁻ esperado (crônica)") === "30–36", `${ids(r)} ${calc(r, "HCO₃⁻ esperado")}`);

// Vômitos: alcalose metabólica, PaCO2 esperada 40 + 0,7 × 14 = 49,8 ± 2 (Berend 2014)
r = analisar({ pH: 7.52, pco2: 48, hco3: 38 });
ok("Alcalose metabólica: PaCO₂ esperada 47,8–51,8", ids(r) === "alk_met" && calc(r, "PaCO₂ esperada") === "47.8–51.8", `${ids(r)} ${calc(r, "PaCO₂ esperada")}`);
r = analisar({ pH: 7.47, pco2: 56, hco3: 40.5 }); // esperada 51,6 ± 2
ok("Alcalose metabólica com PaCO₂ acima de +2: acidose respiratória associada", ids(r) === "acid_resp,alk_met", ids(r));

// Alcalose respiratória crônica: −4 a −5 por 10 mmHg → PaCO2 25: HCO3 14,5–20
r = analisar({ pH: 7.44, pco2: 25, hco3: 17, ctx: { cronico: true } });
ok("Alcalose respiratória crônica: HCO₃⁻ esperado 14,5–20", ids(r) === "alk_resp" && calc(r, "HCO₃⁻ esperado (crônica)") === "14.5–20", `${ids(r)} ${calc(r, "HCO₃⁻ esperado")}`);

// Hipercapnia crônica + AG alto: Δ/Δ deve usar o HCO3 esperado (33), não 24 → sem alcalose metabólica falsa
r = analisar({ pH: 7.31, pco2: 60, hco3: 30, na: 140, cl: 95, alb: 4, ctx: { dpoc: true } });
ok("Hipercapnia crônica + AG alto: Δ/Δ com HCO₃⁻ de referência 33", ids(r) === "acid_met,acid_resp" && calc(r, "Delta-delta") === 1, `${ids(r)} Δ/Δ ${calc(r, "Delta-delta")}`);

// pH baixo com PaCO2 e HCO3 limítrofes: antes saía "sem distúrbio"
r = analisar({ pH: 7.34, pco2: 44, hco3: 23.3 });
ok("pH 7,34 com PaCO₂ 44 e HCO₃⁻ 23,3: não pode dizer 'sem distúrbio'", r.disturbios.length > 0, r.resumo);

// Story 2016 (S.A.L.T): Na−Cl−35; 0,25×(42−alb g/L); 1−lactato
r = analisar({ pH: 7.30, pco2: 32, hco3: 15.5, be: -10, na: 140, cl: 115, alb: 2.2, lact: 4 });
const s = r.stewart.simplificado;
ok("Stewart simplificado (Story 2016): Na−Cl −10, albumina +5, lactato −3, outros −2", s.naCl === -10 && s.alb === 5 && s.lact === -3 && s.outros === -2, JSON.stringify(s));

// Fencl/Figge: SIDa = 140+4+2,4+2×0,823−105−1 = 42,0; SIDe = 24 + 40×0,2792 + 1,129×1,8176 = 37,2
r = analisar({ pH: 7.4, pco2: 40, hco3: 24, na: 140, k: 4, cl: 105, alb: 4, lact: 1, cai: 1.2, mg: 2, fosf: 3.5 });
const co = r.stewart.completo;
ok("Fencl–Figge: SIDa 42,0; SIDe 37,2; SIG 4,8", co.sida === 42 && co.side === 37.2 && co.sig === 4.8, JSON.stringify(co));

// Gás alveolar completo: FiO2 1,0, PaCO2 40 → PAO2 = 713 − 40 = 673; A–a = 173 (a forma simplificada daria 163)
r = analisar({ pH: 7.4, pco2: 40, hco3: 24, pao2: 500, fio2: 100, idade: 60 });
ok("A–a com FiO₂ 1,0 = 173 e sem 'A–a esperado' (só vale em ar ambiente)", r.oxi.aa === 173 && r.oxi.aaEsp === undefined, JSON.stringify(r.oxi));
r = analisar({ pH: 7.4, pco2: 40, hco3: 24, pao2: 90, fio2: 21, idade: 60 });
ok("Ar ambiente: PAO₂ = 149,7 − 40×1,1975 = 102; A–a 12; esperado 19", r.oxi.aa === 12 && r.oxi.aaEsp === 19, JSON.stringify(r.oxi));

// Henderson: incoerência vira o resumo, não só um aviso
r = analisar({ pH: 7.2, pco2: 40, hco3: 24 });
ok("Valores incoerentes aparecem no resumo", r.resumo.startsWith("Valores incoerentes"), r.resumo);

// Unidades trocadas
r = analisar({ pH: 7.3, pco2: 32, hco3: 15.5, na: 138, cl: 106, alb: 20 });
ok("Albumina 20 (g/L) convertida para 2,0 g/dL e AG corrigido = 16,5 + 5 = 21,5", calc(r, "AG corrigido") === 21.5 && r.avisos.some((a) => a.includes("g/L")), `${calc(r, "AG corrigido")} ${r.avisos}`);
r = analisar({ pH: 7.3, pco2: 32, hco3: 15.5, lact: 27 });
ok("Lactato 27 gera aviso de unidade (mg/dL?)", r.avisos.some((a) => a.includes("mg/dL")), r.avisos.join(" | "));

// Condutas atualizadas
r = analisar({ pH: 7.4, pco2: 40, hco3: 24, k: 2.4 });
ok("Hipocalemia na parada: KCl 20 mmol em 2–3 min + 10 mmol em 2 min (ERC 2025)", r.alertas[0].conduta[0].includes("20 mmol IV em 2–3 min") && r.alertas[0].fontes.includes("erc2025"), r.alertas[0].conduta[0]);
r = analisar({ pH: 7.4, pco2: 40, hco3: 24, k: 7 });
ok("Hipercalemia na parada: cálcio + bicarbonato 50 mmol (ERC 2025)", r.alertas[0].conduta.some((c) => c.includes("bicarbonato de sódio 50 mmol")), r.alertas[0].conduta.join(" | "));
r = analisar({ pH: 7.1, pco2: 60, hco3: 18, na: 140, cl: 100, alb: 4, k: 6, peso: 80, ctx: { gatilhoHM: true } });
const hmc = r.hipoteses.find((g) => g.grupo === "Acidose respiratória").itens.find((h) => h.titulo === "Hipertermia maligna").conduta.join(" ");
ok("HM: dantrolene 2,5 mg/kg = 200 mg para 80 kg, máx. 300 mg/dose, até PaCO₂ < 45", hmc.includes("= 200 mg para 80 kg") && hmc.includes("máx. 300 mg") && hmc.includes("PaCO₂ < 45"), hmc);
r = analisar({ pH: 7.25, pco2: 30, hco3: 13, na: 140, cl: 105, alb: 4, ctx: { sepse: true } });
ok("Chip sepse coloca acidose lática tipo A em 1º sem lactato", r.hipoteses[0].itens[0].titulo.startsWith("Acidose lática tipo A") && r.hipoteses[0].itens[0].score === 85, r.hipoteses[0].itens[0].titulo);

// Leitor: glicose sem unidade < 35 não pode virar ×18
let l = lerLaudo("pH 7,30\nGlu 30");
ok("Leitor: 'Glu 30' sem unidade não é preenchida (nem vira 540)", l.valores.glic === undefined, JSON.stringify(l));
l = lerLaudo("pH 7,30\nGlu 30 mg/dL");
ok("Leitor: 'Glu 30 mg/dL' = 30 (hipoglicemia real)", l.valores.glic === 30, JSON.stringify(l));
l = lerLaudo("pH 7,30\nGlu 7,8 mmol/L");
ok("Leitor: 'Glu 7,8 mmol/L' = 140 mg/dL", l.valores.glic === 140, JSON.stringify(l));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos da auditoria passaram"); process.exit(falhas ? 1 : 0);
