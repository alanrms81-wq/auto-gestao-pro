import {
  detectarColuna,
  normalizarTexto,
  somenteDigitos,
  toInt,
  toMoney,
  up,
} from "./normalizar";

export type LinhaCSV = Record<string, string>;

export type ProdutoImportado = {
  nome: string;
  codigo_sku: string;
  codigo_barras: string;
  ncm: string;
  marca: string;
  fornecedor: string;
  categoria: string;
  unidade: string;
  origem: string;
  preco_balcao: number;
  preco_custo: number;
  estoque_atual: number;
  localizacao: string;
  observacoes: string;
  status: string;
};

export const MAPA_CAMPOS_PRODUTOS = {
  nome: [
    "descricao",
    "descrição",
    "nome",
    "nome do produto",
    "produto",
    "descricao curta",
  ],
  codigo_sku: [
    "codigo",
    "código",
    "sku",
    "codigo sku",
    "código sku",
    "referencia",
    "referência",
  ],
  codigo_barras: [
    "gtin",
    "ean",
    "codigo de barras",
    "código de barras",
    "gtin/ean",
  ],
  ncm: ["ncm"],
  marca: ["marca"],
  fornecedor: ["fornecedor", "fabricante principal"],
  categoria: [
    "categoria",
    "categoria do produto",
    "grupo de produtos",
    "grupo",
    "departamento",
  ],
  unidade: ["unidade", "un", "unidade de medida"],
  origem: ["origem"],
  preco_balcao: [
    "preco",
    "preço",
    "preco venda",
    "preço de venda",
    "valor venda",
    "preco unitario",
    "preço unitário",
  ],
  preco_custo: [
    "preco custo",
    "preço custo",
    "custo",
    "valor custo",
  ],
  estoque_atual: [
    "estoque",
    "estoque atual",
    "quantidade",
    "saldo",
  ],
  localizacao: [
    "localizacao",
    "localização",
    "local",
    "endereco estoque",
  ],
  observacoes: [
    "observacoes",
    "observação",
    "obs",
    "descricao complementar",
  ],
};

export function detectarDelimitadorCSV(texto: string) {
  const primeiraLinha = texto.split(/\r?\n/)[0] || "";
  const qtdPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const qtdVirgula = (primeiraLinha.match(/,/g) || []).length;
  return qtdPontoVirgula > qtdVirgula ? ";" : ",";
}

export function converterProdutos(data: LinhaCSV[]) {
  if (!data.length) {
    return {
      produtos: [] as ProdutoImportado[],
      colunas: {} as Record<string, string>,
    };
  }

  const headers = Object.keys(data[0] || {});

  const colunas = {
    nome: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.nome),
    codigo_sku: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.codigo_sku),
    codigo_barras: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.codigo_barras),
    ncm: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.ncm),
    marca: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.marca),
    fornecedor: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.fornecedor),
    categoria: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.categoria),
    unidade: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.unidade),
    origem: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.origem),
    preco_balcao: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.preco_balcao),
    preco_custo: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.preco_custo),
    estoque_atual: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.estoque_atual),
    localizacao: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.localizacao),
    observacoes: detectarColuna(headers, MAPA_CAMPOS_PRODUTOS.observacoes),
  };

  const produtos = data.map((row) => {
    const categoriaBruta =
      row[colunas.categoria] ||
      row["Categoria do produto"] ||
      row["Grupo de produtos"] ||
      "";

    return {
      nome: up(row[colunas.nome]),
      codigo_sku: up(row[colunas.codigo_sku]),
      codigo_barras: somenteDigitos(row[colunas.codigo_barras]),
      ncm: somenteDigitos(row[colunas.ncm]),
      marca: up(row[colunas.marca]),
      fornecedor: up(row[colunas.fornecedor]),
      categoria: up(categoriaBruta),
      unidade: up(row[colunas.unidade] || "UN"),
      origem: up(row[colunas.origem]),
      preco_balcao: toMoney(row[colunas.preco_balcao]),
      preco_custo: toMoney(row[colunas.preco_custo]),
      estoque_atual: toInt(row[colunas.estoque_atual]),
      localizacao: up(row[colunas.localizacao]),
      observacoes: up(row[colunas.observacoes]),
      status: "ATIVO",
    };
  });

  return { produtos, colunas };
}

export function validarProdutosImportados(produtos: ProdutoImportado[]) {
  const validos: ProdutoImportado[] = [];
  const ignorados: ProdutoImportado[] = [];

  for (const item of produtos) {
    if (!item.nome) {
      ignorados.push(item);
      continue;
    }

    validos.push(item);
  }

  return { validos, ignorados };
}

export function deduplicarProdutos(produtos: ProdutoImportado[]) {
  const mapa = new Map<string, ProdutoImportado>();

  for (const item of produtos) {
    const chave =
      normalizarTexto(item.codigo_sku) ||
      normalizarTexto(item.codigo_barras) ||
      normalizarTexto(item.nome);

    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, item);
  }

  return Array.from(mapa.values());
}