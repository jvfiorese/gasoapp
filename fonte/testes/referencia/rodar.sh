#!/bin/sh
# Compara o motor do app com a calculadora de referência (Python) em ~2.600 gasometrias aleatórias coerentes.
cd "$(dirname "$0")" && python3 gerar.py >/dev/null && node dump.js ../../src/motor.js app.json && python3 referencia.py app.json; rm -f casos.json app.json
