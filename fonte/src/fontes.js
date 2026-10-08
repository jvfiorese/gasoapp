// Registro de fontes. nivel: 1 = algoritmo de interpretação, 2 = guideline/ECR de conduta, 3 = livro/revisão (sem guideline específico)
const FONTES = {
  berend2014: { nivel: 1, ref: "Berend K, de Vries APJ, Gans ROB. Physiological approach to assessment of acid–base disturbances. N Engl J Med 2014;371:1434-45.", url: "" },
  kraut2010: { nivel: 1, ref: "Kraut JA, Madias NE. Metabolic acidosis: pathophysiology, diagnosis and management. Nat Rev Nephrol 2010;6:274-85.", url: "" },
  seifter2014: { nivel: 1, ref: "Seifter JL. Integration of acid–base and electrolyte disorders. N Engl J Med 2014;371:1821-31.", url: "" },
  figge1998: { nivel: 1, ref: "Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med 1998;26:1807-10.", url: "" },
  rastegar2007: { nivel: 1, ref: "Rastegar A. Use of the ΔAG/ΔHCO3− ratio in the diagnosis of mixed acid-base disorders. J Am Soc Nephrol 2007;18:2429-31.", url: "" },
  story2016: { nivel: 1, ref: "Story DA. Stewart acid-base: a simplified bedside approach. Anesth Analg 2016;123:511-5.", url: "" },
  fencl2000: { nivel: 1, ref: "Fencl V, Jabor A, Kazda A, Figge J. Diagnosis of metabolic acid-base disturbances in critically ill patients. Am J Respir Crit Care Med 2000;162:2246-51.", url: "" },
  kraut2014lact: { nivel: 2, ref: "Kraut JA, Madias NE. Lactic acidosis. N Engl J Med 2014;371:2309-19.", url: "" },
  ukka2023: { nivel: 2, ref: "UK Kidney Association. Clinical Practice Guideline: Treatment of acute hyperkalaemia in adults (2023, atualizada jul/2026).", url: "https://www.ukkidney.org/health-professionals/guidelines/guidelines-commentaries" },
  erc2025: { nivel: 2, ref: "Lott C et al. European Resuscitation Council Guidelines 2025: Special circumstances in resuscitation. Resuscitation 2025;215(Suppl 1):110753.", url: "https://doi.org/10.1016/j.resuscitation.2025.110753" },
  bicaricu2018: { nivel: 2, ref: "Jaber S et al. BICAR-ICU. Sodium bicarbonate therapy for patients with severe metabolic acidaemia in the ICU. Lancet 2018;392:31-40.", url: "" },
  bicaricu2_2025: { nivel: 2, ref: "Jaber S et al. BICARICU-2. Sodium bicarbonate for severe metabolic acidemia and acute kidney injury. JAMA 2025.", url: "https://jamanetwork.com/journals/jama/fullarticle/2840824" },
  ada2024: { nivel: 2, ref: "Umpierrez GE et al. Hyperglycemic crises in adults with diabetes: a consensus report (ADA/EASD/JBDS/AACE/DTS). Diabetes Care 2024;47:1257-75.", url: "" },
  adasoc2025: { nivel: 2, ref: "American Diabetes Association. Standards of Care in Diabetes 2025, seção 16: Diabetes care in the hospital. Diabetes Care 2025;48(Suppl 1).", url: "https://diabetesjournals.org/care/issue/48/Supplement_1" },
  ssc2021: { nivel: 2, ref: "Evans L et al. Surviving Sepsis Campaign: international guidelines 2021. Crit Care Med 2021;49:e1063-143.", url: "" },
  smart2018: { nivel: 2, ref: "Semler MW et al. SMART. Balanced crystalloids versus saline in critically ill adults. N Engl J Med 2018;378:829-39.", url: "" },
  plus2022: { nivel: 2, ref: "Finfer S et al. PLUS. Balanced multielectrolyte solution versus saline in critically ill adults. N Engl J Med 2022;386:815-26.", url: "" },
  emhg2024: { nivel: 2, ref: "European Malignant Hyperthermia Group. Recognising and managing a malignant hyperthermia crisis (v2024).", url: "https://www.emhg.org/recommendations-1/2024/11/4/recognising-and-managing-a-malignant-hyperthermia-crisis-v2024" },
  young2019: { nivel: 2, ref: "Young CC et al. Lung-protective ventilation for the surgical patient: international expert panel-based consensus recommendations. Br J Anaesth 2019;123:898-913.", url: "" },
  esicm2023: { nivel: 2, ref: "Grasselli G et al. ESICM guidelines on acute respiratory distress syndrome. Intensive Care Med 2023;49:727-59.", url: "" },
  ese2014: { nivel: 2, ref: "Spasovski G et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia (ESE/ESICM/ERBP). Eur J Endocrinol 2014;170:G1-47.", url: "" },
  trauma2023: { nivel: 2, ref: "Rossaint R et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care 2023;27:80.", url: "" },
  esc2019: { nivel: 2, ref: "Konstantinides SV et al. 2019 ESC Guidelines for acute pulmonary embolism. Eur Heart J 2020;41:543-603.", url: "" },
  emmett2020: { nivel: 3, ref: "Emmett M. Metabolic alkalosis: a brief pathophysiologic review. Clin J Am Soc Nephrol 2020;15:1848-56.", url: "" },
  miller: { nivel: 3, semLink: true, ref: "Gropper MA et al. Miller's Anesthesia, 10ª ed. Elsevier, 2024 (sem guideline específico para este item).", url: "" },
};
if (typeof module !== "undefined") module.exports = { FONTES };
// Sem URL direta: link de busca no PubMed pelo título (evita PMID errado).
function linkFonte(id) {
  const f = FONTES[id]; if (!f) return "";
  if (f.url) return f.url;
  if (f.semLink) return "";
  const m = f.ref.match(/\.\s(.+?)\.\s[A-Z][^.]*\s(19|20)\d\d/);
  if (!m) return "";
  const autor = f.ref.split(" ")[0];
  const termo = m[1].replace(/^[A-Z0-9-]+\.\s/, "") + " " + autor;
  return "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(termo);
}
if (typeof module !== "undefined") module.exports.linkFonte = linkFonte;
