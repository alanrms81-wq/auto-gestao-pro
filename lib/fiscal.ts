export type EmpresaFiscal = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  im?: string;
  crt: "1" | "2" | "3"; // 1 Simples, 2 Simples excesso, 3 Regime normal

  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  codigoMunicipio: string;

  telefone: string;
  email: string;

  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  serieNfe: string;
  proximoNumeroNfe: string;

  certificadoTipo: "A1" | "A3" | "";
  certificadoArquivoBase64?: string;
  certificadoSenha?: string;

  tokenCsc?: string;
  cscId?: string;

  observacoesDanfe?: string;
};

export type ClienteFiscal = {
  nome: string;
  cpfCnpj: string;
  ie?: string;
  indicadorIe?: "9" | "1" | "2"; // 9 não contribuinte, 1 contribuinte, 2 isento
  email?: string;
  telefone?: string;

  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  codigoMunicipio?: string;
};

export type ProdutoFiscal = {
  codigo: string;
  descricao: string;
  ncm: string;
  cest?: string;
  cfop: string;
  unidade: string;
  origem: string; // 0 nacional etc
  cstCsosn: string;
  aliquotaIcms: number;
  aliquotaPis?: number;
  aliquotaCofins?: number;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
};

export const LS_EMPRESA_FISCAL = "empresa_fiscal_config";

export function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export function maskCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function up(v: any) {
  return String(v ?? "").toUpperCase();
}

export function readLS<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getEmpresaFiscalDefault(): EmpresaFiscal {
  return {
    razaoSocial: "AUTO GESTÃO PRO LTDA",
    nomeFantasia: "AUTO GESTÃO PRO",
    cnpj: "",
    ie: "ISENTO",
    im: "",
    crt: "1",

    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    codigoMunicipio: "",

    telefone: "",
    email: "",

    ambiente: "HOMOLOGACAO",
    serieNfe: "1",
    proximoNumeroNfe: "1",

    certificadoTipo: "",
    certificadoArquivoBase64: "",
    certificadoSenha: "",

    tokenCsc: "",
    cscId: "",

    observacoesDanfe: "",
  };
}

export function getEmpresaFiscal(): EmpresaFiscal {
  return readLS<EmpresaFiscal>(LS_EMPRESA_FISCAL, getEmpresaFiscalDefault());
}

export function saveEmpresaFiscal(data: EmpresaFiscal) {
  writeLS(LS_EMPRESA_FISCAL, data);
}
