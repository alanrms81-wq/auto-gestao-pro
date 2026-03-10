export function normalizarTexto(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function up(valor: unknown) {
  return String(valor ?? "").trim().toUpperCase();
}

export function limparNumero(valor: unknown) {
  return String(valor ?? "").replace(/[^\d.-]/g, "");
}

export function toMoney(valor: unknown) {
  const texto = String(valor ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

export function toInt(valor: unknown) {
  const numero = Number(limparNumero(valor));
  return Number.isFinite(numero) ? numero : 0;
}

export function somenteDigitos(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "");
}

export function detectarColuna(headersOriginais: string[], aliases: string[]) {
  const mapa = headersOriginais.map((h) => ({
    original: h,
    normalizado: normalizarTexto(h),
  }));

  for (const alias of aliases) {
    const aliasNorm = normalizarTexto(alias);
    const encontrada = mapa.find((h) => h.normalizado === aliasNorm);
    if (encontrada) return encontrada.original;
  }

  for (const alias of aliases) {
    const aliasNorm = normalizarTexto(alias);
    const encontrada = mapa.find((h) => h.normalizado.includes(aliasNorm));
    if (encontrada) return encontrada.original;
  }

  return "";
}