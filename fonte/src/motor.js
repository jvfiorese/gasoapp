// Motor de interpretação de gasometria arterial (abordagem tradicional, Berend NEJM 2014) + Stewart (Story 2016, Fencl 2000).
// Regras determinísticas. Unidades: PaCO2/PaO2 mmHg; HCO3, Na, K, Cl, lactato mmol/L; albumina g/dL;
// glicose mg/dL; Ca iônico mmol/L; Mg e fosfato mg/dL; FiO2 em fração (0,21–1,0) ou %.

const NORMAL = { pHmin: 7.35, pHmax: 7.45, pco2min: 35, pco2max: 45, hco3min: 22, hco3max: 26, ag: 12, alb: 4.0, hco3: 24, pco2: 40 };

const num = (v) => (v === undefined || v === null || v === "" || isNaN(+v) ? null : +v);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function analisar(entrada) {
  const e = {};
  for (const k of ["pH", "pco2", "hco3", "be", "na", "k", "cl", "alb", "lact", "glic", "cai", "mg", "fosf", "pao2", "fio2", "etco2", "idade", "peso", "patm"]) e[k] = num(entrada[k]);
  const ctx = entrada.ctx || {};
  if (e.fio2 !== null && e.fio2 > 1) e.fio2 = e.fio2 / 100;

  const R = { calculos: [], avisos: [], disturbios: [], alertas: [], hipoteses: [], oxi: null, stewart: null, resumo: "" };
  // Unidades trocadas: corrigir só quando o valor é impossível na unidade esperada, e avisar.
  if (e.alb !== null && e.alb > 10) { R.avisos.push(`Albumina ${e.alb} lida como g/L e convertida para ${r1(e.alb / 10)} g/dL.`); e.alb = e.alb / 10; }
  if (e.cai !== null && e.cai > 3) { R.avisos.push(`Ca²⁺ iônico ${e.cai} lido como mg/dL e convertido para ${r2(e.cai / 4.008)} mmol/L.`); e.cai = e.cai / 4.008; }
  if (e.lact !== null && e.lact > 15) R.avisos.push(`Lactato ${e.lact} mmol/L é muito alto: confira se o laudo não está em mg/dL (mg/dL ÷ 9 = mmol/L).`);
  if (e.mg !== null && e.mg < 1.0) R.avisos.push(`Mg ${e.mg}: o campo é em mg/dL. Se o laudo estiver em mmol/L, multiplique por 2,43.`);
  const calc = (nome, valor, formula) => R.calculos.push({ nome, valor, formula });

  if (e.pH === null || e.pco2 === null || e.hco3 === null) {
    R.avisos.push("Preencha pH, PaCO₂ e HCO₃⁻ para interpretar.");
    return R;
  }

  // 1. Coerência interna (Henderson-Hasselbalch)
  const hPlus = (24 * e.pco2) / e.hco3; // nmol/L
  const pHcalc = 9 - Math.log10(hPlus);
  calc("pH calculado (Henderson)", r2(pHcalc), "H⁺ = 24 × PaCO₂ / HCO₃⁻; pH = 9 − log[H⁺]");
  R.incoerente = Math.abs(pHcalc - e.pH) > 0.04;
  if (R.incoerente) R.avisos.push(`Valores incoerentes: pH medido ${e.pH} vs. calculado ${r2(pHcalc)}. Confira digitação ou repita a amostra.`);

  // BE padrão (Van Slyke) se não informado
  const sbe = e.be !== null ? e.be : r1(0.93 * (e.hco3 - 24.4 + 14.83 * (e.pH - 7.4)));
  if (e.be === null) calc("SBE estimado", sbe, "0,93 × (HCO₃⁻ − 24,4 + 14,83 × (pH − 7,4))");

  // 2-3. Distúrbio primário
  const acidemia = e.pH < NORMAL.pHmin, alcalemia = e.pH > NORMAL.pHmax;
  const hco3Baixo = e.hco3 < NORMAL.hco3min, hco3Alto = e.hco3 > NORMAL.hco3max;
  const pco2Alto = e.pco2 > NORMAL.pco2max, pco2Baixo = e.pco2 < NORMAL.pco2min;
  const cronico = !!(ctx.cronico || ctx.dpoc); // DPOC / hipercapnia crônica implica compensação renal crônica
  const prim = [];
  if (acidemia) {
    if (hco3Baixo) prim.push("acid_met");
    if (pco2Alto) prim.push("acid_resp");
    // pH baixo com PaCO2 e HCO3 ainda na faixa normal: usar a direção em relação a 40 / 24
    if (!prim.length) { if (e.hco3 < NORMAL.hco3) prim.push("acid_met"); if (e.pco2 > NORMAL.pco2) prim.push("acid_resp"); }
  } else if (alcalemia) {
    if (hco3Alto) prim.push("alk_met");
    if (pco2Baixo) prim.push("alk_resp");
    if (!prim.length) { if (e.hco3 > NORMAL.hco3) prim.push("alk_met"); if (e.pco2 < NORMAL.pco2) prim.push("alk_resp"); }
  } else {
    // pH normal com PaCO2 e HCO3 alterados = misto (ou compensação completa crônica)
    if (pco2Alto && hco3Alto) prim.push(e.pH < 7.4 ? "acid_resp" : "alk_met");
    if (pco2Baixo && hco3Baixo) prim.push(e.pH < 7.4 ? "acid_met" : "alk_resp");
  }

  const add = (id, texto, extra = {}) => { if (!R.disturbios.find((d) => d.id === id)) R.disturbios.push({ id, texto, ...extra }); };

  // 4. Compensação esperada
  let hco3Ref = NORMAL.hco3; // HCO3 de referência do delta-delta: o esperado pela compensação, se houver distúrbio respiratório primário
  for (const p of prim) {
    if (p === "acid_met") {
      add("acid_met", "Acidose metabólica", { primario: true });
      const esp = 1.5 * e.hco3 + 8;
      calc("PaCO₂ esperada (Winter)", `${r1(esp - 2)}–${r1(esp + 2)}`, "1,5 × HCO₃⁻ + 8 ± 2");
      if (e.pco2 > esp + 2) add("acid_resp", "Acidose respiratória associada (compensação insuficiente)");
      else if (e.pco2 < esp - 2) add("alk_resp", "Alcalose respiratória associada");
    }
    if (p === "alk_met") {
      add("alk_met", "Alcalose metabólica", { primario: true });
      const esp = 40 + 0.7 * (e.hco3 - 24);
      calc("PaCO₂ esperada", `${r1(esp - 2)}–${r1(esp + 2)}`, "40 + 0,7 × (HCO₃⁻ − 24) ± 2");
      if (e.pco2 > esp + 2) add("acid_resp", "Acidose respiratória associada");
      else if (e.pco2 < esp - 2) add("alk_resp", "Alcalose respiratória associada");
    }
    if (p === "acid_resp") {
      add("acid_resp", `Acidose respiratória ${cronico ? "crônica" : "aguda"}`, { primario: true });
      const d = (e.pco2 - 40) / 10;
      // aguda: +1 por 10 mmHg; crônica: +4 a +5 por 10 mmHg (Berend 2014, tabela 1)
      const lo = cronico ? 24 + 4 * d - 2 : 24 + d - 2, hi = cronico ? 24 + 5 * d + 2 : 24 + d + 2;
      hco3Ref = cronico ? 24 + 4.5 * d : 24 + d;
      calc(`HCO₃⁻ esperado (${cronico ? "crônica" : "aguda"})`, `${r1(lo)}–${r1(hi)}`, cronico ? "24 + 4 a 5 × ΔPaCO₂/10 ± 2" : "24 + 1 × ΔPaCO₂/10 ± 2");
      if (e.hco3 > hi) add("alk_met", cronico ? "Alcalose metabólica associada" : "Alcalose metabólica associada (ou componente crônico: DPOC?)");
      else if (e.hco3 < lo) add("acid_met", "Acidose metabólica associada");
    }
    if (p === "alk_resp") {
      add("alk_resp", `Alcalose respiratória ${cronico ? "crônica" : "aguda"}`, { primario: true });
      const d = (40 - e.pco2) / 10;
      // aguda: −2 por 10 mmHg; crônica: −4 a −5 por 10 mmHg (Berend 2014, tabela 1)
      const lo = cronico ? 24 - 5 * d - 2 : 24 - 2 * d - 2, hi = cronico ? 24 - 4 * d + 2 : 24 - 2 * d + 2;
      hco3Ref = cronico ? 24 - 4.5 * d : 24 - 2 * d;
      calc(`HCO₃⁻ esperado (${cronico ? "crônica" : "aguda"})`, `${r1(lo)}–${r1(hi)}`, cronico ? "24 − 4 a 5 × ΔPaCO₂/10 ± 2" : "24 − 2 × ΔPaCO₂/10 ± 2");
      if (e.hco3 < lo) add("acid_met", "Acidose metabólica associada");
      else if (e.hco3 > hi) add("alk_met", "Alcalose metabólica associada");
    }
  }
  if (!prim.length && !acidemia && !alcalemia) R.resumoBase = "Equilíbrio ácido-base sem distúrbio primário evidente";

  // 5. Ânion gap corrigido e delta-delta
  let agc = null;
  if (e.na !== null && e.cl !== null) {
    const ag = e.na - (e.cl + e.hco3);
    calc("Ânion gap", r1(ag), "Na⁺ − (Cl⁻ + HCO₃⁻)");
    agc = ag;
    if (e.alb !== null) {
      agc = ag + 2.5 * (NORMAL.alb - e.alb);
      calc("AG corrigido (albumina)", r1(agc), "AG + 2,5 × (4,0 − albumina g/dL)");
    } else R.avisos.push("Sem albumina: AG não corrigido. Hipoalbuminemia (comum no intraop) mascara AG alto.");
    const temAcidMet = R.disturbios.some((d) => d.id === "acid_met");
    if (agc > NORMAL.ag + 2) {
      if (!temAcidMet) add("acid_met", "Acidose metabólica com AG alto (oculta pelo pH/HCO₃⁻)");
      const dm = R.disturbios.find((d) => d.id === "acid_met"); dm.ag = "alto"; if (!/AG/.test(dm.texto)) dm.texto += " com AG alto";
      const dAG = agc - NORMAL.ag, dHCO3 = hco3Ref - e.hco3;
      if (dHCO3 > 0.5) {
        const ratio = dAG / dHCO3;
        calc("Delta-delta (ΔAG/ΔHCO₃⁻)", r2(ratio), hco3Ref === NORMAL.hco3 ? "(AGc − 12) / (24 − HCO₃⁻)" : `(AGc − 12) / (${r1(hco3Ref)} − HCO₃⁻); ${r1(hco3Ref)} = HCO₃⁻ esperado pela compensação respiratória`);
        if (ratio < 0.8) add("acid_met_nag", "Acidose metabólica hiperclorêmica associada (Δ/Δ < 0,8)");
        else if (ratio < 1) R.avisos.push(`Δ/Δ ${r2(ratio)} (0,8–1): possível componente hiperclorêmico associado; comum na cetoacidose.`);
        else if (ratio > 2) add("alk_met", "Alcalose metabólica associada (Δ/Δ > 2)");
      } else add("alk_met", "Alcalose metabólica associada (AG alto com HCO₃⁻ não reduzido)");
    } else if (temAcidMet) {
      const dm = R.disturbios.find((d) => d.id === "acid_met"); dm.ag = "normal"; dm.texto += " com AG normal (hiperclorêmica)";
    }
  } else if (R.disturbios.some((d) => d.id === "acid_met")) R.avisos.push("Informe Na⁺ e Cl⁻ para calcular ânion gap e diferenciar a acidose metabólica.");

  // 6. Oxigenação
  if (e.pao2 !== null) {
    const ox = {};
    if (e.fio2 !== null) {
      ox.pf = Math.round(e.pao2 / e.fio2);
      calc("PaO₂/FiO₂", ox.pf, "PaO₂ / FiO₂");
      const patm = e.patm || 760;
      // Equação completa do gás alveolar (R = 0,8): a forma simplificada (PaCO2/0,8) superestima o A–a em até 10 mmHg com FiO2 alta
      const pAO2 = e.fio2 * (patm - 47) - e.pco2 * (e.fio2 + (1 - e.fio2) / 0.8);
      ox.pAO2 = Math.round(pAO2);
      ox.aa = Math.round(pAO2 - e.pao2);
      calc("PAO₂ (gás alveolar)", ox.pAO2, "FiO₂ × (Patm − 47) − PaCO₂ × [FiO₂ + (1 − FiO₂)/0,8]");
      calc("Gradiente A–a", ox.aa, "PAO₂ − PaO₂");
      if (e.idade !== null && e.fio2 <= 0.25) { ox.aaEsp = Math.round(e.idade / 4 + 4); calc("A–a esperado (ar ambiente)", ox.aaEsp, "idade/4 + 4 (válido só em ar ambiente)"); }
      ox.classe = ox.pf >= 300 ? "normal" : ox.pf >= 200 ? "leve (200–300)" : ox.pf >= 100 ? "moderada (100–200)" : "grave (< 100)";
    }
    ox.hipoxemia = e.pao2 < 60 || (ox.pf !== undefined && ox.pf < 300);
    if (e.pao2 > 300) ox.hiperoxia = true;
    R.oxi = ox;
  }
  if (e.etco2 !== null) {
    const gap = e.pco2 - e.etco2;
    calc("Gradiente PaCO₂ − EtCO₂", r1(gap), "normal 2–5 mmHg");
    R.gapCO2 = gap;
  }

  // 7. Stewart
  R.stewart = stewart(e, sbe);

  // 8. Alertas e hipóteses
  R.alertas = alertas(e, R, ctx);
  R.hipoteses = hipoteses(e, R, ctx);

  R.resumo = R.disturbios.length ? R.disturbios.map((d) => d.texto).join(" + ") : R.resumoBase || "Sem distúrbio ácido-base";
  if (R.incoerente) R.resumo = "Valores incoerentes (pH × PaCO₂ × HCO₃⁻): confira antes de usar. Leitura provisória: " + R.resumo;
  R.estado = acidemia ? "acidemia" : alcalemia ? "alcalemia" : "pH normal";
  R.sbe = sbe;
  return R;
}

function stewart(e, sbe) {
  if (e.na === null || e.cl === null) return null;
  const S = { simplificado: {}, completo: null, avisos: [] };
  // Story 2016 (efeitos em mEq/L sobre o BE): Na−Cl−35; 0,25 × (42 − albumina g/L); 1 − lactato
  const naCl = e.na - e.cl - 35;
  const albEf = e.alb !== null ? 0.25 * (42 - e.alb * 10) : null;
  const lacEf = e.lact !== null ? 1 - e.lact : null;
  const outros = sbe - naCl - (albEf || 0) - (lacEf || 0);
  S.simplificado = { sbe, naCl: r1(naCl), alb: albEf === null ? null : r1(albEf), lact: lacEf === null ? null : r1(lacEf), outros: r1(outros) };
  if (albEf === null) S.avisos.push("Sem albumina: efeito da albumina não calculado e incluído em 'outros ânions'.");
  if (lacEf === null) S.avisos.push("Sem lactato: efeito do lactato incluído em 'outros ânions'.");
  // Fencl/Figge: SIDa, SIDe, SIG
  if (e.k !== null && e.alb !== null) {
    const ca = e.cai !== null ? e.cai : 1.2, mg = e.mg !== null ? e.mg / 2.43 : 0.9, fosf = e.fosf !== null ? e.fosf / 3.1 : 1.1;
    if (e.cai === null || e.mg === null || e.fosf === null) S.avisos.push("Ca iônico, Mg ou fosfato ausentes: assumidos normais (1,2 / 0,9 / 1,1 mmol/L) no SIG.");
    const sida = e.na + e.k + 2 * ca + 2 * mg - e.cl - (e.lact || 0);
    const side = e.hco3 + e.alb * 10 * (0.123 * e.pH - 0.631) + fosf * (0.309 * e.pH - 0.469);
    S.completo = { sida: r1(sida), side: r1(side), sig: r1(sida - side) };
  }
  return S;
}

// ---------- Alertas (conduta imediata por valor crítico) ----------
function alertas(e, R, ctx) {
  const A = [];
  const peso = e.peso;
  if (e.k !== null && e.k >= 6.0) {
    const grave = e.k >= 6.5;
    A.push({
      nivel: grave ? "critico" : "alto", titulo: `Hipercalemia ${grave ? "grave" : "moderada"} (K⁺ ${e.k})`,
      conduta: [
        "ECG/monitor agora. Se alteração no ECG: gluconato de cálcio 10% 30 mL IV em 10 min ou cloreto de cálcio 10% 10 mL IV em 5 min (ambos ≈ 6,8 mmol de Ca²⁺); reavaliar ECG e repetir após 5 min se persistir.",
        "Parada cardíaca por hipercalemia: cloreto de cálcio 10% 10 mL IV + bicarbonato de sódio 50 mmol IV (ex.: 50 mL de 8,4%), em vias separadas ou com flush entre eles (ERC 2025).",
        "Amostra hemolisada ou K⁺ inesperado: repetir a dosagem, sem atrasar o tratamento se o ECG estiver alterado.",
        "Insulina regular 10 UI + glicose 25 g IV (ex.: 50 mL de glicose 50% ou 125 mL de 20%) em 15 min. Se glicemia pré < 126 mg/dL: glicose 10% 50 mL/h por 5 h. Glicemia em 0, 30, 60, 90, 120 min e depois de hora em hora até 6 h.",
        grave ? "Salbutamol 10–20 mg nebulizado como adjuvante (nunca isolado)." : "Considerar salbutamol 10–20 mg nebulizado como adjuvante.",
        "Intraop: suspender succinilcolina; corrigir acidose respiratória (aumentar ventilação); se transfusão, preferir concentrado mais recente; pensar em HM, rabdomiólise, reperfusão de membro/órgão.",
        "Remover K⁺: ciclossilicato de zircônio sódico 10 g VO 8/8 h (quando possível via enteral); diálise se refratária ou LRA oligúrica.",
        "Fora da parada, bicarbonato não é rotina para hipercalemia (só se acidose metabólica grave associada).",
      ],
      fontes: ["ukka2023", "erc2025"],
    });
  }
  if (e.k !== null && e.k < 3.0) {
    A.push({
      nivel: e.k < 2.5 ? "critico" : "alto", titulo: `Hipocalemia ${e.k < 2.5 ? "grave" : "moderada"} (K⁺ ${e.k})`,
      conduta: [
        "Parada cardíaca por hipocalemia: KCl 20 mmol IV em 2–3 min, depois 10 mmol em 2 min; então ajustar pela dosagem de K⁺ (ERC 2025).",
        "Sem arritmia: KCl IV 10 mmol/h em veia periférica; até 20 mmol/h só em acesso central com ECG contínuo. Dosar K⁺ após cada 20–40 mmol.",
        "Repor magnésio junto: sulfato de magnésio 2 g (8 mmol) IV em 10–20 min se Mg baixo ou desconhecido.",
        "Intraop: hiperventilação e alcalose, β-agonistas e insulina pioram a hipocalemia.",
      ],
      fontes: ["erc2025", "miller"],
    });
  }
  if (e.pH < 7.1) A.push({ nivel: "critico", titulo: `Acidemia grave (pH ${e.pH})`, conduta: ["Tratar a causa (ver hipóteses abaixo). Assegurar ventilação adequada para o componente respiratório.", "Vasopressores e inotrópicos perdem eficácia com pH < 7,1–7,2."], fontes: ["berend2014", "kraut2010"] });
  if (e.pH > 7.6) A.push({ nivel: "critico", titulo: `Alcalemia grave (pH ${e.pH})`, conduta: ["Se ventilado: reduzir ventilação minuto se PaCO₂ baixa.", "Checar K⁺ e Ca²⁺ iônico (caem com alcalemia, risco de arritmia)."], fontes: ["berend2014", "emmett2020"] });
  if (e.lact !== null && e.lact >= 2) A.push({ nivel: e.lact >= 4 ? "critico" : "alto", titulo: `Hiperlactatemia (${e.lact} mmol/L)`, conduta: ["Avaliar perfusão (PAM, débito, sangramento, Hb). PAM alvo ≥ 65 mmHg; noradrenalina como vasopressor de 1ª linha.", "Repetir lactato em 2 h para guiar a ressuscitação.", "Ver hipóteses de acidose lática abaixo."], fontes: ["ssc2021", "kraut2014lact"] });
  if (e.cai !== null && (e.cai < 0.9 || (ctx.transfusao && e.cai < 1.1))) A.push({ nivel: e.cai < 0.9 ? "critico" : "alto", titulo: `Hipocalcemia iônica (${e.cai} mmol/L)`, conduta: ["Cloreto de cálcio 10% 10 mL IV (preferir acesso central) ou gluconato de cálcio 10% 30 mL IV em 10 min.", "Na transfusão maciça: monitorar Ca²⁺ iônico e manter na faixa normal (> 1,1 mmol/L); citrato quela cálcio."], fontes: ["trauma2023"] });
  if (e.na !== null && e.na < 130) {
    const rtu = ctx.rtu;
    A.push({ nivel: e.na < 125 || rtu ? "critico" : "alto", titulo: `Hiponatremia (Na⁺ ${e.na})${rtu ? ": suspeitar síndrome pós-RTU/histeroscopia" : ""}`, conduta: [
      "Sintomas graves (convulsão, rebaixamento, ou no intraop sob anestesia com Na⁺ caindo agudamente): NaCl 3% 150 mL IV em 20 min; dosar Na⁺ e repetir até 2× até subir 5 mmol/L.",
      "Limite: não elevar mais que 10 mmol/L nas primeiras 24 h.",
      rtu ? "RTU/histeroscopia: interromper o procedimento/irrigação, quantificar absorção do líquido de irrigação, furosemida só se sobrecarga volêmica." : "Avaliar fluidos hipotônicos administrados.",
    ], fontes: ["ese2014"] });
  }
  if (e.glic !== null && e.glic < 70) A.push({ nivel: e.glic < 54 ? "critico" : "alto", titulo: `Hipoglicemia (${e.glic} mg/dL)`, conduta: ["Glicose 10–25 g IV (ex.: 20–50 mL de glicose 50%); repetir glicemia em 15 min.", "Sob anestesia os sinais são mascarados: tratar pelo número."], fontes: ["adasoc2025"] });
  if (e.glic !== null && e.glic > 180) A.push({ nivel: e.glic > 250 ? "alto" : "medio", titulo: `Hiperglicemia (${e.glic} mg/dL)`, conduta: ["Alvo perioperatório 100–180 mg/dL: insulina IV em infusão conforme protocolo institucional.", e.glic >= 200 && R.disturbios.some((d) => d.ag === "alto") ? "Glicemia ≥ 200 + acidose AG alto: investigar cetoacidose (β-hidroxibutirato ≥ 3,0)." : ""].filter(Boolean), fontes: ["adasoc2025", "ada2024"] });
  if (R.oxi && (e.pao2 < 60 || (R.oxi.pf !== undefined && R.oxi.pf < 100))) A.push({ nivel: "critico", titulo: `Hipoxemia grave (PaO₂ ${e.pao2}${R.oxi.pf !== undefined ? `, P/F ${R.oxi.pf}` : ""})`, conduta: ["FiO₂ 1,0; checar posição e permeabilidade do tubo, ausculta bilateral, curva de capnografia e pressões de via aérea.", "Ver hipóteses de hipoxemia abaixo."], fontes: ["young2019"] });
  if (e.pco2 > 80) A.push({ nivel: "critico", titulo: `Hipercapnia grave (PaCO₂ ${e.pco2})`, conduta: ["Verificar circuito, ventilador e absorvedor de CO₂; aumentar ventilação minuto.", "Se EtCO₂ subindo sem explicação + taquicardia + acidose mista: considerar hipertermia maligna."], fontes: ["emhg2024", "young2019"] });
  return A;
}

// ---------- Hipóteses ----------
function hipoteses(e, R, ctx) {
  const tem = (id) => R.disturbios.some((d) => d.id === id);
  const acidMet = R.disturbios.find((d) => d.id === "acid_met");
  const H = [];
  const peso = e.peso;
  const dose = (mgkg, max, unid = "mg") => (peso ? ` (= ${Math.min(Math.round(mgkg * peso), max || Infinity)} ${unid} para ${peso} kg)` : "");
  const push = (grupo, h) => H.push({ grupo, ...h });

  // --- Acidose respiratória ---
  if (tem("acid_resp")) {
    const g = "Acidose respiratória";
    const gap = R.gapCO2;
    push(g, { titulo: "Hipoventilação (ajuste ventilatório, vazamento, desconexão parcial, efeito residual de opioide/BNM em ventilação espontânea)", score: 80,
      reforca: ["EtCO₂ alto com gradiente PaCO₂−EtCO₂ normal", "VM baixa no ventilador"], afasta: ["Gradiente PaCO₂−EtCO₂ aumentado (sugere espaço morto)"],
      conduta: ["Checar circuito, vazamentos e volume corrente expirado.", "Aumentar a frequência respiratória primeiro, mantendo VC 6–8 mL/kg de peso predito e PEEP ≥ 5 cmH₂O.", "Hipercapnia permissiva é aceitável com ventilação protetora se pH ≥ 7,20 e sem hipertensão intracraniana/hipertensão pulmonar grave."],
      fontes: ["young2019", "esicm2023"] });
    push(g, { titulo: "Absorção de CO₂ do pneumoperitônio (± enfisema subcutâneo, capnotórax)", score: ctx.laparoscopia ? 95 : 5,
      reforca: ["Laparoscopia/robótica em curso", "Elevação gradual de EtCO₂ após insuflação", "Crepitação subcutânea (enfisema)"], afasta: ["Sem insuflação de CO₂"],
      conduta: ["Aumentar ventilação minuto (FR) 15–30%.", "Reduzir pressão de pneumoperitônio ao mínimo efetivo (10–12 mmHg).", "Se EtCO₂ refratário ou enfisema extenso: pausar insuflação e discutir com cirurgião."],
      fontes: ["miller"] });
    push(g, { titulo: "Hipertermia maligna", score: (ctx.gatilhoHM ? 50 : 10) + (tem("acid_met") ? 25 : 0) + (e.k !== null && e.k > 5.5 ? 15 : 0),
      reforca: ["EtCO₂ subindo apesar de aumento da ventilação", "Taquicardia, rigidez (masseter), hipertermia (tardia)", "Acidose mista + hipercalemia", "Exposição a halogenado ou succinilcolina"], afasta: ["Anestesia venosa total sem succinilcolina"],
      conduta: ["Suspender halogenado e succinilcolina; chamar ajuda; avisar cirurgião para concluir o mais breve possível.", "Hiperventilar com O₂ 100% em alto fluxo (VM 2–3× o normal); instalar filtros de carvão ativado; manter anestesia com TIVA.", `Dantrolene 2–2,5 mg/kg IV pelo peso real${dose(2.5, 300)}, máx. 300 mg por dose; repetir a cada 10 min até PaCO₂ < 45 mmHg (6 kPa) com ventilação minuto normal e temperatura caindo. Total de 10 mg/kg pode ser excedido se o diagnóstico se confirmar.`, "Resfriar ativamente; parar quando T < 38,5 °C.", "Bicarbonato de sódio se pH < 7,2; tratar hipercalemia (insulina + glicose, cálcio).", "Diferenciais: sepse, tireotoxicose, feocromocitoma, síndrome serotoninérgica, sobreaquecimento."],
      fontes: ["emhg2024"] });
    push(g, { titulo: "Aumento do espaço morto: TEP, embolia gasosa/CO₂, baixo débito cardíaco", score: gap !== undefined && gap > 10 ? 85 : 15,
      reforca: ["Gradiente PaCO₂−EtCO₂ > 10 mmHg", "Queda súbita de EtCO₂ com hipotensão e hipoxemia", "Insuflação de CO₂, acesso venoso aberto acima do coração"], afasta: ["Gradiente PaCO₂−EtCO₂ normal"],
      conduta: ["FiO₂ 1,0; suporte hemodinâmico.", "Embolia gasosa/CO₂: interromper insuflação e desinsuflar, decúbito lateral esquerdo + Trendelenburg, aspirar pelo cateter venoso central se houver.", "TEP de alto risco com instabilidade: anticoagulação e reperfusão; no intraop a trombólise sistêmica é contraindicação relativa, considerar embolectomia cirúrgica ou por cateter.", "Ecocardiograma (VD dilatado) se disponível."],
      fontes: ["esc2019", "miller"] });
    push(g, { titulo: "Reinalação: absorvedor de CO₂ esgotado ou válvula unidirecional incompetente", score: 20,
      reforca: ["FiCO₂ (CO₂ inspirado) > 0 na capnografia", "Linha de base da capnografia elevada"], afasta: ["FiCO₂ = 0"],
      conduta: ["Aumentar fluxo de gás fresco acima da ventilação minuto.", "Trocar a cal sodada; checar válvulas."], fontes: ["miller"] });
    push(g, { titulo: "Broncoespasmo / obstrução (auto-PEEP)", score: ctx.dpoc ? 40 : 15,
      reforca: ["Pressão de pico alta, curva de capnografia em 'barbatana de tubarão'", "Sibilos, DPOC/asma"], afasta: ["Pressões de via aérea normais"],
      conduta: ["Aprofundar plano com halogenado; aumentar tempo expiratório (reduzir FR, I:E 1:3–1:4).", "Salbutamol inalatório no circuito, 4–8 jatos de 100 µg, repetir conforme resposta.", "Grave/refratário: adrenalina IV em bolus titulados de 10–50 µg.", "Excluir obstrução do tubo e intubação seletiva."], fontes: ["miller"] });
    if (ctx.dpoc) push(g, { titulo: "Hipercapnia crônica de base (DPOC)", score: 50, reforca: ["HCO₃⁻ elevado compatível com compensação crônica"], afasta: [], conduta: ["Ventilar para a PaCO₂ habitual do paciente, não para 40 mmHg (evita alcalose pós-hipercápnica)."], fontes: ["berend2014"] });
  }

  // --- Alcalose respiratória ---
  if (tem("alk_resp")) {
    const g = "Alcalose respiratória";
    push(g, { titulo: "Hiperventilação iatrogênica no ventilador", score: ctx.ventilado === false ? 5 : 90, reforca: ["Paciente em ventilação controlada", "EtCO₂ baixo"], afasta: ["Ventilação espontânea"],
      conduta: ["Reduzir ventilação minuto (FR) para PaCO₂ 35–45 mmHg.", "Hipocapnia reduz fluxo sanguíneo cerebral e desloca a curva da Hb para a esquerda; desejada apenas em hipertensão intracraniana aguda, por curto período."], fontes: ["young2019"] });
    push(g, { titulo: "Hipoxemia, dor, ansiedade, sepse inicial ou TEP (ventilação espontânea)", score: ctx.ventilado === false ? 70 : 10, reforca: ["Paciente acordado/sedação leve", "Hipoxemia associada"], afasta: [], conduta: ["Tratar a causa: oxigênio, analgesia, investigar sepse/TEP."], fontes: ["berend2014", "esc2019"] });
  }

  // --- Acidose metabólica AG alto ---
  if (acidMet && acidMet.ag !== "normal") {
    const g = acidMet.ag === "alto" ? "Acidose metabólica com AG alto" : "Acidose metabólica (AG não calculado)";
    const lact = e.lact;
    push(g, { titulo: "Acidose lática tipo A: hipoperfusão (hemorragia, hipovolemia, choque, sepse)", score: lact !== null ? (lact >= 2 ? 95 : ctx.sepse ? 30 : 10) : ctx.sepse ? 85 : 60,
      reforca: ["Lactato ≥ 2 mmol/L", "Sangramento, hipotensão, vasopressor em uso", "Sepse/choque"].concat(ctx.sepse ? ["Contexto marcado: sepse/choque"] : []), afasta: ["Lactato normal"],
      conduta: ["Controlar a fonte (sangramento/foco séptico).", "Fluidos guiados por responsividade, preferindo cristaloide balanceado; sepse com hipoperfusão: 30 mL/kg nas primeiras 3 h (recomendação fraca) e reavaliar.", "PAM ≥ 65 mmHg com noradrenalina como 1ª linha.", "Hemorragia: hemocomponentes conforme protocolo de transfusão maciça; manter Ca²⁺ iônico normal.", "Repetir lactato em 2 h."],
      fontes: ["ssc2021", "trauma2023", "kraut2014lact"] });
    push(g, { titulo: "Acidose lática tipo B: adrenalina em infusão, metformina, nitroprussiato (cianeto), síndrome de infusão de propofol", score: lact !== null && lact >= 2 ? 40 : 5,
      reforca: ["Lactato alto com perfusão adequada", "Adrenalina em infusão (efeito β2, geralmente benigno)", "Nitroprussiato em dose alta/prolongada", "Infusão de propofol > 4 mg/kg/h por > 48 h"], afasta: ["Perfusão inadequada (pensar tipo A primeiro)"],
      conduta: ["Adrenalina: considerar trocar/reduzir se a perfusão estiver adequada.", "Suspeita de cianeto (nitroprussiato): suspender e dar hidroxocobalamina 5 g IV em 15 min.", "Síndrome de infusão de propofol: suspender propofol, suporte."], fontes: ["kraut2014lact"] });
    push(g, { titulo: "Cetoacidose diabética (inclusive euglicêmica por iSGLT2)", score: (ctx.diabetes ? 40 : 0) + (ctx.isglt2 ? 40 : 0) + (e.glic !== null && e.glic >= 200 ? 30 : 0),
      reforca: ["Diabetes, uso de iSGLT2 (gliflozinas), jejum prolongado", "β-hidroxibutirato ≥ 3,0 mmol/L", "Glicemia ≥ 200 mg/dL (pode estar normal se iSGLT2)"], afasta: ["Cetonemia negativa"],
      conduta: ["Cristaloide 500–1.000 mL/h nas primeiras 2–4 h.", `Insulina regular IV 0,1 UI/kg/h${peso ? ` (= ${r1(0.1 * peso)} UI/h)` : ""}. Se K⁺ < 3,5: adiar insulina e repor K⁺ 10–20 mmol/h até > 3,5.`, "K⁺ 3,5–5,0: 10–20 mmol de KCl em cada litro de soro; K⁺ > 5,0: não repor.", "Adicionar glicose 5–10% quando glicemia < 250 mg/dL (na euglicêmica, desde o início junto com a insulina).", "Bicarbonato apenas se pH < 7,0."],
      fontes: ["ada2024"] });
    push(g, { titulo: "Lesão renal aguda / DRC (acúmulo de ânions)", score: ctx.renal ? 70 : 15,
      reforca: ["LRA ou DRC conhecida", "Creatinina/ureia elevadas", "Hipercalemia associada"], afasta: ["Função renal normal"],
      conduta: ["pH ≤ 7,20, HCO₃⁻ ≤ 20 e PaCO₂ ≤ 45 mmHg com LRA KDIGO 2–3: bicarbonato de sódio 4,2% 125–250 mL IV em 30 min, repetir até pH ≥ 7,30, máx. 1.000 mL/24 h. Reduziu necessidade de diálise (BICAR-ICU, BICARICU-2), sem reduzir mortalidade em 90 dias (BICARICU-2).", "Garantir ventilação capaz de eliminar o CO₂ gerado pelo bicarbonato.", "Indicações de diálise: acidose ou hipercalemia refratárias, sobrecarga volêmica."],
      fontes: ["bicaricu2_2025", "bicaricu2018"] });
    push(g, { titulo: "Intoxicações (metanol, etilenoglicol, salicilato)", score: 3, reforca: ["Gap osmolal elevado", "História de ingestão"], afasta: ["Contexto cirúrgico eletivo sem história sugestiva"], conduta: ["Dosar osmolalidade e calcular gap osmolal; acionar centro de toxicologia."], fontes: ["kraut2010"] });
  }

  // --- Acidose metabólica AG normal (hiperclorêmica) ---
  if ((acidMet && acidMet.ag === "normal") || tem("acid_met_nag")) {
    const g = "Acidose metabólica hiperclorêmica (AG normal)";
    push(g, { titulo: "Infusão de grandes volumes de SF 0,9% (hipercloremia dilucional)", score: ctx.sf ? 95 : 70,
      reforca: ["Volume grande de SF 0,9%", "Cl⁻ elevado", "Diferença Na⁺−Cl⁻ < 32"], afasta: ["Uso exclusivo de soluções balanceadas"],
      conduta: ["Trocar para cristaloide balanceado (Ringer lactato ou Plasma-Lyte).", "SMART mostrou menos eventos renais adversos com balanceados; PLUS e BaSICS foram neutros para mortalidade, sem dano.", "Em geral não exige bicarbonato."],
      fontes: ["smart2018", "plus2022", "story2016"] });
    push(g, { titulo: "Perdas intestinais de bicarbonato (diarreia, fístula, drenos biliares/pancreáticos, derivação ureteral)", score: 25,
      reforca: ["Drenos de alto débito, preparo de cólon, neobexiga/ureterossigmoidostomia"], afasta: [],
      conduta: ["Repor perdas com cristaloide balanceado; corrigir K⁺."], fontes: ["kraut2010"] });
    push(g, { titulo: "Acidose tubular renal, acetazolamida, fase de recuperação da CAD", score: 10,
      reforca: ["DRC, uso de acetazolamida/topiramato", "CAD em tratamento"], afasta: [],
      conduta: ["Geralmente sem conduta intraop imediata; investigar com AG urinário depois."], fontes: ["kraut2010"] });
  }

  // --- Alcalose metabólica ---
  if (tem("alk_met")) {
    const g = "Alcalose metabólica";
    push(g, { titulo: "Citrato de transfusão maciça", score: ctx.transfusao ? 90 : 5, reforca: ["Muitos hemocomponentes", "Ca²⁺ iônico baixo"], afasta: [], conduta: ["Geralmente autolimitada; monitorar e repor Ca²⁺ iônico; checar K⁺."], fontes: ["trauma2023"] });
    push(g, { titulo: "Alcalose pós-hipercápnica (hipercapnia crônica corrigida rápido)", score: ctx.dpoc ? 80 : 10, reforca: ["DPOC/hipercapnia crônica", "PaCO₂ levada a 40 mmHg no ventilador"], afasta: [], conduta: ["Ventilar para a PaCO₂ basal do paciente."], fontes: ["berend2014", "emmett2020"] });
    push(g, { titulo: "Perda gástrica (vômitos, SNG aberta), diuréticos, hipocalemia", score: 40, reforca: ["Cl⁻ baixo", "SNG de alto débito, diurético recente", "K⁺ baixo"], afasta: [],
      conduta: ["Cloro-responsiva: expandir com SF 0,9% e repor KCl.", "Repor K⁺ e Mg²⁺."], fontes: ["emmett2020"] });
    push(g, { titulo: "Bicarbonato ou outras bases administradas (bicarbonato, citrato, acetato)", score: 25, reforca: ["Bicarbonato recebido no intraop"], afasta: [], conduta: ["Suspender o aporte de álcali."], fontes: ["emmett2020"] });
  }

  // --- Oxigenação ---
  if (R.oxi && R.oxi.hipoxemia) {
    const g = `Hipoxemia${R.oxi.pf !== undefined ? ` (P/F ${R.oxi.pf}, ${R.oxi.classe})` : ""}`;
    push(g, { titulo: "Atelectasia", score: 70, reforca: ["Obesidade, laparoscopia, Trendelenburg, FiO₂ alta, PEEP baixa"], afasta: [], conduta: ["Manobra de recrutamento (ex.: PEEP crescente até pressão de platô 30–40 cmH₂O, se hemodinâmica estável) e depois PEEP individualizada.", "VC 6–8 mL/kg de peso predito; PEEP ≥ 5 cmH₂O."], fontes: ["young2019"] });
    push(g, { titulo: "Intubação seletiva, deslocamento ou obstrução do tubo", score: 60, reforca: ["Mudança de posição, pneumoperitônio, Trendelenburg", "Aumento súbito da pressão de pico", "Ausculta assimétrica"], afasta: [], conduta: ["Ausculta bilateral; checar marcação do tubo; fibroscopia se disponível; aspirar."], fontes: ["miller"] });
    push(g, { titulo: "Broncoespasmo, aspiração, pneumotórax, edema pulmonar", score: 30, reforca: ["Pressões altas, sibilos (broncoespasmo)", "Hipotensão + ausculta abolida unilateral (pneumotórax)", "Balanço hídrico muito positivo (edema)"], afasta: [], conduta: ["Pneumotórax hipertensivo: descompressão imediata e drenagem.", "Aspiração: aspirar via aérea; sem antibiótico profilático de rotina.", "Edema: PEEP, diurético conforme volemia."], fontes: ["miller"] });
    push(g, { titulo: "TEP / embolia gasosa", score: R.gapCO2 !== undefined && R.gapCO2 > 10 ? 70 : 15, reforca: ["Gradiente PaCO₂−EtCO₂ aumentado", "Hipotensão súbita"], afasta: [], conduta: ["Ver conduta de espaço morto acima."], fontes: ["esc2019"] });
    push(g, { titulo: "SDRA (se P/F < 300 com PEEP ≥ 5 e infiltrado bilateral)", score: R.oxi.pf !== undefined && R.oxi.pf < 200 ? 40 : 10, reforca: ["Sepse, aspiração, transfusão (TRALI)"], afasta: [], conduta: ["VC 6 mL/kg de peso predito; pressão de platô < 30 cmH₂O; PEEP mais alta se moderada/grave; prona se P/F < 150 (UTI)."], fontes: ["esicm2023"] });
  }
  if (R.oxi && R.oxi.hiperoxia) push("Hiperóxia", { titulo: `PaO₂ ${e.pao2} mmHg`, score: 20, reforca: [], afasta: [], conduta: ["Considerar reduzir FiO₂ para o mínimo que mantenha SpO₂ 94–98%, exceto em contexto que justifique FiO₂ alta."], fontes: ["young2019"] });

  // ordenar grupos: primeiro os do distúrbio primário, depois os associados, por último oxigenação; score dentro do grupo
  const primarios = R.disturbios.filter((d) => d.primario).map((d) => d.id);
  const idDoGrupo = (g) => (g.startsWith("Acidose respiratória") ? "acid_resp" : g.startsWith("Alcalose respiratória") ? "alk_resp" : g.startsWith("Alcalose metabólica") ? "alk_met" : g.startsWith("Acidose metabólica") ? "acid_met" : null);
  const peso_ = (g) => (idDoGrupo(g) === null ? 2 : primarios.includes(idDoGrupo(g)) ? 0 : 1);
  const ordemGrupo = [];
  H.forEach((h) => { if (!ordemGrupo.includes(h.grupo)) ordemGrupo.push(h.grupo); });
  ordemGrupo.sort((a, b) => peso_(a) - peso_(b));
  return ordemGrupo.map((g) => ({ grupo: g, itens: H.filter((h) => h.grupo === g && h.score > 0).sort((a, b) => b.score - a.score) }));
}

if (typeof module !== "undefined") module.exports = { analisar };
