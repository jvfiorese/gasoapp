// Leitor de laudo de gasometria a partir de texto (Texto ao Vivo do iPhone colado no app).
// Genérico por rótulo; calibrar por aparelho com laudos reais. Prefere valores a 37 °C (ignora "(T)") e HCO3 real (não o padrão).

const KPA_PARA_MMHG = 7.50062;

// Cada campo: lista de regex do rótulo (ordem = preferência) e conversão opcional de unidade.
const ROTULOS = {
  pH: [/(?<![a-z])pH(?!\s*\(T\))(?!\s*T\b)/i],
  pco2: [/p\s?CO\s?2(?!\s*\(T\))(?!\s*T\b)/i],
  pao2: [/p\s?O\s?2(?!\s*\(T\))(?!\s*T\b)(?!\s*\(A)/i],
  hco3: [/c?HCO\s?3\s*[-−⁻]?\s*\(P\)(?!\s*,?\s*st)/i, /HCO\s?3\s*[-−⁻]?\s*act/i, /c?HCO\s?3\s*[-−⁻]?(?!\s*(\(P\s*,\s*st|std|st\b|\(st))/i],
  be: [/c?Base\s*\(\s*Ecf\s*\)/i, /BE\s*\(?\s*ecf\s*\)?/i, /SBE/i, /c?Base\s*\(\s*B\s*\)/i, /BE\s*\(?\s*B\s*\)?/i, /(?<![a-z])BE(?![a-z])/i],
  na: [/c?Na\s*\+/i, /(?<![a-z])Na(?![a-z])/i],
  k: [/c?K\s*\+/i, /(?<![a-z])K(?![a-z])/],
  cl: [/c?Cl\s*[-−⁻]/i, /(?<![a-z])Cl(?![a-z])/i],
  cai: [/c?Ca\s*(2\s*\+|\+\+)/i, /iCa/i, /Ca\s*ion/i],
  glic: [/c?Glu(cose)?/i, /Glic(ose)?/i],
  lact: [/c?Lac(tat[eo])?/i],
  fio2: [/FiO\s?2/i, /FO\s?2\s*\(\s*I\s*\)/i],
};

function normalizar(t) {
  return t
    .replace(/[₂²]/g, "2").replace(/[₃³]/g, "3").replace(/[⁺]/g, "+").replace(/[−–—⁻]/g, "-")
    .replace(/(\d),(\d)/g, "$1.$2").replace(/\r/g, "");
}

// Primeiro número depois do rótulo, na mesma linha; se não houver, na linha seguinte.
function numeroApos(linhas, i, fim) {
  const resto = linhas[i].slice(fim);
  const m = resto.match(/(-?\d+(?:\.\d+)?)/);
  if (m) return { v: +m[1], un: resto.slice(m.index + m[1].length) };
  if (i + 1 < linhas.length) { const n = linhas[i + 1].match(/^\s*(-?\d+(?:\.\d+)?)(.*)$/); if (n) return { v: +n[1], un: n[2] }; }
  return null;
}

function lerLaudo(texto) {
  const linhas = normalizar(texto).split("\n").map((l) => l.trim()).filter(Boolean);
  const out = {}, notas = [];
  for (const [campo, regs] of Object.entries(ROTULOS)) {
    achou: for (const re of regs) {
      for (let i = 0; i < linhas.length; i++) {
        const m = linhas[i].match(re);
        if (!m) continue;
        const r = numeroApos(linhas, i, m.index + m[0].length);
        if (!r) continue;
        out[campo] = { v: r.v, un: r.un };
        break achou;
      }
    }
  }
  // Conversões e checagens de plausibilidade
  const fim = {};
  for (const [c, { v, un }] of Object.entries(out)) {
    let x = v;
    const u = un.toLowerCase();
    if ((c === "pco2" || c === "pao2") && (/kpa/.test(u) || (c === "pco2" && x < 15) || (c === "pao2" && x < 40 && /kpa/.test(texto.toLowerCase())))) { x = Math.round(x * KPA_PARA_MMHG); notas.push(`${c === "pco2" ? "PaCO₂" : "PaO₂"} convertida de kPa para mmHg.`); }
    // Glicose: converter só com unidade mmol/L explícita. Sem unidade e valor < 35, não preencher
    // (35 mg/dL é hipoglicemia real; 35 mmol/L seria 630 mg/dL: o erro nos dois sentidos é perigoso).
    if (c === "glic" && /mmol/.test(u)) { x = Math.round(x * 18); notas.push("Glicose convertida de mmol/L para mg/dL."); }
    else if (c === "glic" && !/mg/.test(u) && x < 35) { notas.push(`Glicose ${x} sem unidade no texto: não preenchida (mg/dL ou mmol/L?). Digite à mão.`); continue; }
    if (c === "lact" && /mg/.test(u)) { x = Math.round((x / 9.01) * 10) / 10; notas.push("Lactato convertido de mg/dL para mmol/L."); }
    if (c === "cai" && x > 3) { x = Math.round((x / 4.008) * 100) / 100; notas.push("Ca²⁺ iônico convertido de mg/dL para mmol/L."); }
    if (c === "fio2" && x <= 1) x = Math.round(x * 100);
    const faixa = { pH: [6.5, 8], pco2: [5, 200], pao2: [10, 700], hco3: [1, 60], be: [-40, 40], na: [90, 200], k: [1, 12], cl: [60, 150], cai: [0.3, 3], glic: [10, 2000], lact: [0, 40], fio2: [21, 100] }[c];
    if (faixa && (x < faixa[0] || x > faixa[1])) { notas.push(`Valor de ${c} fora do esperado (${x}); não preenchido.`); continue; }
    fim[c] = x;
  }
  return { valores: fim, notas };
}

if (typeof module !== "undefined") module.exports = { lerLaudo };
