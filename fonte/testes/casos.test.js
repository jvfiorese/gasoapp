// Casos de teste do motor. Rodar: node testes/casos.test.js
const { analisar } = require("../src/motor.js");
let falhas = 0;
function caso(nome, entrada, esperado) {
  const r = analisar(entrada);
  const ids = r.disturbios.map((d) => d.id).sort().join(",");
  const ok = ids === esperado.slice().sort().join(",") && (!esperado.check || esperado.check(r));
  const extra = esperado.check ? esperado.check(r) : true;
  const okFinal = ids === [...esperado].sort().join(",") && extra;
  if (!okFinal) falhas++;
  console.log(`${okFinal ? "OK  " : "FALHA"} ${nome}\n      ${r.resumo}  [${ids}]${r.avisos.length ? "\n      avisos: " + r.avisos.join(" | ") : ""}`);
  return r;
}
const comCheck = (arr, fn) => Object.assign([...arr], { check: fn });

caso("Acidose metabólica AG alto pura, compensada", { pH: 7.26, pco2: 27, hco3: 12, na: 140, cl: 106, alb: 4 }, ["acid_met"]);
caso("Acidose metabólica AG alto + hiperclorêmica", { pH: 7.2, pco2: 23, hco3: 9, na: 140, cl: 114, alb: 4 }, ["acid_met", "acid_met_nag"]);
caso("Acidose metabólica + acidose respiratória (compensação insuficiente)", { pH: 7.15, pco2: 40, hco3: 13.5, na: 140, cl: 104, alb: 4 }, ["acid_met", "acid_resp"]);
caso("Acidose respiratória aguda pura", { pH: 7.24, pco2: 60, hco3: 26 }, ["acid_resp"]);
caso("Acidose respiratória crônica compensada (DPOC)", { pH: 7.34, pco2: 60, hco3: 31, ctx: { cronico: true } }, ["acid_resp"]);
caso("Acid resp aguda + alcalose metabólica", { pH: 7.32, pco2: 60, hco3: 31 }, ["acid_resp", "alk_met"]);
caso("Alcalose metabólica pura", { pH: 7.5, pco2: 48, hco3: 36 }, ["alk_met"]);
caso("Alcalose respiratória aguda (hiperventilação no ventilador)", { pH: 7.55, pco2: 26, hco3: 22 }, ["alk_resp"]);
caso("pH normal: AG alto + alcalose metabólica ocultas", { pH: 7.4, pco2: 40, hco3: 24, na: 145, cl: 100, alb: 4 }, ["acid_met", "alk_met"]);
caso("Hiperclorêmica por SF", { pH: 7.3, pco2: 32, hco3: 15.5, na: 140, cl: 116, alb: 4, ctx: { sf: true } }, ["acid_met"],);
caso("AG mascarado por hipoalbuminemia", { pH: 7.3, pco2: 32, hco3: 15.5, na: 138, cl: 106, alb: 2.0 }, comCheck(["acid_met"], (r) => r.disturbios[0].ag === "alto"));
const hm = caso("Hipertermia maligna (acidose mista + K alto)", { pH: 7.1, pco2: 60, hco3: 18, na: 140, cl: 100, k: 6.8, lact: 6, alb: 4, peso: 80, ctx: { gatilhoHM: true } },
  comCheck(["acid_resp", "acid_met"], (r) => r.hipoteses.find((g) => g.grupo === "Acidose respiratória").itens[0].titulo.startsWith("Hipertermia")));
console.log("      1ª hipótese resp:", hm.hipoteses[0].itens[0].titulo, "| alertas:", hm.alertas.map((a) => a.titulo).join("; "));
const lap = caso("Laparoscopia: hipercapnia", { pH: 7.28, pco2: 56, hco3: 25.5, etco2: 50, ctx: { laparoscopia: true } }, comCheck(["acid_resp"], (r) => r.hipoteses[0].itens[0].titulo.startsWith("Absorção")));
caso("Espaço morto (gap PaCO2-EtCO2 alto)", { pH: 7.3, pco2: 52, hco3: 25, etco2: 30 }, comCheck(["acid_resp"], (r) => r.hipoteses[0].itens[0].titulo.startsWith("Aumento do espaço morto")));
caso("Normal", { pH: 7.4, pco2: 40, hco3: 24, na: 140, cl: 104, alb: 4 }, []);
caso("Incoerente (aviso)", { pH: 7.2, pco2: 40, hco3: 24 }, comCheck([], (r) => r.avisos.some((a) => a.includes("incoerentes"))));
const ox = analisar({ pH: 7.4, pco2: 40, hco3: 24, pao2: 80, fio2: 60, idade: 60 });
console.log(`OK? P/F=${ox.oxi.pf} (esperado 133) A-a=${ox.oxi.aa}`); if (ox.oxi.pf !== 133) falhas++;
const st = analisar({ pH: 7.3, pco2: 32, hco3: 15.5, na: 140, cl: 116, k: 4, alb: 2.5, lact: 1, cai: 1.1, mg: 2, fosf: 3.5 });
console.log("Stewart:", JSON.stringify(st.stewart));
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram");
process.exit(falhas ? 1 : 0);
