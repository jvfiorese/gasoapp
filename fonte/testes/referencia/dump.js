const { analisar } = require(require("path").resolve(process.argv[2]));
const casos = require("./casos.json");
const out = casos.map((c) => { const r = analisar(JSON.parse(JSON.stringify(c))); return { calc: Object.fromEntries(r.calculos.map((x) => [x.nome, x.valor])), st: r.stewart, ox: r.oxi, ids: r.disturbios.map((d) => d.id).sort(), ag: (r.disturbios.find((d) => d.id === "acid_met") || {}).ag || null, sbe: r.sbe }; });
require("fs").writeFileSync(process.argv[3], JSON.stringify(out));
