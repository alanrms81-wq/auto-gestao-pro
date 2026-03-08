"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";

type FinanceiroTitulo = {
  id: number;
  tipo: "RECEBER" | "PAGAR";
  descricao: string;
  categoria: string;
  clienteId?: number | null;
  clienteNome?: string;
  documento?: string;
  formaPagamento?: string;
  valorOriginal: number;
  valorPago: number;
  desconto: number;
  juros: number;
  multa: number;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  status: string;
  observacoes?: string;
  createdAt: string;
};

type FluxoLancamento = {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  origem?: string;
  observacoes?: string;
};

const LS_TITULOS = "financeiro_titulos";
const LS_FLUXO = "financeiro_lancamentos";

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toMoney(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function valorLiquidoTitulo(t: FinanceiroTitulo) {
  return (
    toMoney(t.valorOriginal) +
    toMoney(t.juros) +
    toMoney(t.multa) -
    toMoney(t.desconto)
  );
}

function saldoAbertoTitulo(t: FinanceiroTitulo) {
  return Math.max(0, valorLiquidoTitulo(t) - toMoney(t.valorPago));
}

function statusFinanceiro(t: FinanceiroTitulo) {
  const manual = up(t.status || "");

  if (manual === "CANCELADO") return "CANCELADO";

  const saldo = saldoAbertoTitulo(t);

  if (saldo <= 0) return "PAGO";
  if (toMoney(t.valorPago) > 0) return "PARCIAL";
  if (t.dataVencimento && t.dataVencimento < hojeISO()) return "VENCIDO";
  return "ABERTO";
}

export default function FinanceiroPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [titulos, setTitulos] = useState<FinanceiroTitulo[]>([]);
  const [fluxo, setFluxo] = useState<FluxoLancamento[]>([]);
  const [busca, setBusca] = useState("");

  const [recebendoId, setRecebendoId] = useState<number | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [descontoRecebimento, setDescontoRecebimento] = useState("0");
  const [jurosRecebimento, setJurosRecebimento] = useState("0");
  const [multaRecebimento, setMultaRecebimento] = useState("0");
  const [dataRecebimento, setDataRecebimento] = useState(hojeISO());
  const [observacaoRecebimento, setObservacaoRecebimento] = useState("");

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("FINANCEIRO")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    carregarBase();
    setReady(true);
  }, [router]);

  function carregarBase() {
    setTitulos(readLS<FinanceiroTitulo[]>(LS_TITULOS, []));
    setFluxo(readLS<FluxoLancamento[]>(LS_FLUXO, []));
  }

  const titulosFiltrados = useMemo(() => {
    const q = up(busca.trim());

    return [...titulos]
      .map((t) => ({
        ...t,
        statusCalc: statusFinanceiro(t),
        saldoAberto: saldoAbertoTitulo(t),
        valorLiquido: valorLiquidoTitulo(t),
      }))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .filter((t) => {
        if (!q) return true;
        const texto = up(
          `${t.descricao} ${t.clienteNome || ""} ${t.documento || ""} ${t.categoria || ""} ${t.statusCalc}`
        );
        return texto.includes(q);
      });
  }, [titulos, busca]);

  const totalReceberAberto = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => {
        const st = statusFinanceiro(t);
        return st === "ABERTO" || st === "PARCIAL" || st === "VENCIDO";
      })
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  const totalPagarAberto = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "PAGAR")
      .filter((t) => {
        const st = statusFinanceiro(t);
        return st === "ABERTO" || st === "PARCIAL" || st === "VENCIDO";
      })
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  const totalRecebido = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .reduce((acc, t) => acc + toMoney(t.valorPago), 0);
  }, [titulos]);

  const totalVencido = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => statusFinanceiro(t) === "VENCIDO")
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  function abrirRecebimento(t: FinanceiroTitulo) {
    const saldo = saldoAbertoTitulo(t);

    setRecebendoId(t.id);
    setValorRecebido(String(saldo));
    setDescontoRecebimento("0");
    setJurosRecebimento("0");
    setMultaRecebimento("0");
    setDataRecebimento(hojeISO());
    setObservacaoRecebimento("");
  }

  function cancelarRecebimento() {
    setRecebendoId(null);
    setValorRecebido("");
    setDescontoRecebimento("0");
    setJurosRecebimento("0");
    setMultaRecebimento("0");
    setDataRecebimento(hojeISO());
    setObservacaoRecebimento("");
  }

  function receberTitulo() {
    if (!recebendoId) return;

    const listaTitulos = readLS<FinanceiroTitulo[]>(LS_TITULOS, []);
    const listaFluxo = readLS<FluxoLancamento[]>(LS_FLUXO, []);
    const titulo = listaTitulos.find((t) => t.id === recebendoId);

    if (!titulo) {
      alert("TÍTULO NÃO ENCONTRADO.");
      return;
    }

    const valorRec = toMoney(valorRecebido);
    const desc = toMoney(descontoRecebimento);
    const juros = toMoney(jurosRecebimento);
    const multa = toMoney(multaRecebimento);

    if (valorRec <= 0) {
      alert("INFORME O VALOR RECEBIDO.");
      return;
    }

    const novoDesconto = toMoney(titulo.desconto) + desc;
    const novoJuros = toMoney(titulo.juros) + juros;
    const novaMulta = toMoney(titulo.multa) + multa;
    const novoValorPago = toMoney(titulo.valorPago) + valorRec;

    const valorLiquido = toMoney(titulo.valorOriginal) + novoJuros + novaMulta - novoDesconto;
    const saldoNovo = Math.max(0, valorLiquido - novoValorPago);

    const novoStatus = saldoNovo <= 0 ? "PAGO" : "PARCIAL";

    const titulosAtualizados = listaTitulos.map((t) =>
      t.id === recebendoId
        ? {
            ...t,
            desconto: novoDesconto,
            juros: novoJuros,
            multa: novaMulta,
            valorPago: novoValorPago,
            dataPagamento: dataRecebimento,
            status: novoStatus,
            observacoes: up(
              `${t.observacoes || ""} ${observacaoRecebimento || ""}`.trim()
            ),
          }
        : t
    );

    const fluxoLancamento: FluxoLancamento = {
      id: Date.now(),
      tipo: "ENTRADA",
      descricao: up(`RECEBIMENTO ${titulo.descricao}`),
      categoria: titulo.categoria || "FINANCEIRO",
      valor: valorRec,
      data: dataRecebimento,
      origem: "FINANCEIRO",
      observacoes: up(observacaoRecebimento || titulo.clienteNome || ""),
    };

    writeLS(LS_TITULOS, titulosAtualizados);
    writeLS(LS_FLUXO, [...listaFluxo, fluxoLancamento]);

    carregarBase();
    cancelarRecebimento();
    alert("RECEBIMENTO LANÇADO COM SUCESSO!");
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">FINANCEIRO ERP</h1>
            <div className="text-sm text-[#6C757D]">
              CONTAS, RECEBIMENTOS, PARCIAIS, JUROS, MULTA E DESCONTO
            </div>
          </div>

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="BUSCAR TÍTULO..."
            className="border p-2 rounded-lg w-80 max-w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">A RECEBER</div>
            <div className="text-2xl font-black mt-2">{moneyBR(totalReceberAberto)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">A PAGAR</div>
            <div className="text-2xl font-black mt-2">{moneyBR(totalPagarAberto)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">RECEBIDO</div>
            <div className="text-2xl font-black mt-2">{moneyBR(totalRecebido)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">VENCIDO</div>
            <div className="text-2xl font-black mt-2">{moneyBR(totalVencido)}</div>
          </div>
        </div>

        {recebendoId && (
          <div className="bg-white rounded-2xl shadow p-4 mb-6">
            <div className="text-sm font-bold text-[#6C757D] mb-3">
              BAIXA FINANCEIRA / RECEBIMENTO
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <input
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="VALOR RECEBIDO"
                className="border p-2 rounded"
              />

              <input
                value={descontoRecebimento}
                onChange={(e) => setDescontoRecebimento(e.target.value)}
                placeholder="DESCONTO"
                className="border p-2 rounded"
              />

              <input
                value={jurosRecebimento}
                onChange={(e) => setJurosRecebimento(e.target.value)}
                placeholder="JUROS"
                className="border p-2 rounded"
              />

              <input
                value={multaRecebimento}
                onChange={(e) => setMultaRecebimento(e.target.value)}
                placeholder="MULTA"
                className="border p-2 rounded"
              />

              <input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="border p-2 rounded"
              />

              <input
                value={observacaoRecebimento}
                onChange={(e) => setObservacaoRecebimento(e.target.value)}
                placeholder="OBSERVAÇÃO"
                className="border p-2 rounded"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={receberTitulo}
                className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
                type="button"
              >
                CONFIRMAR RECEBIMENTO
              </button>

              <button
                onClick={cancelarRecebimento}
                className="border px-4 py-2 rounded-lg"
                type="button"
              >
                CANCELAR
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="p-3 text-left">TIPO</th>
                <th className="p-3 text-left">DESCRIÇÃO</th>
                <th className="p-3 text-left">CLIENTE</th>
                <th className="p-3 text-left">VENCIMENTO</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-right">VALOR</th>
                <th className="p-3 text-right">PAGO</th>
                <th className="p-3 text-right">SALDO</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {titulosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#6C757D]">
                    NENHUM TÍTULO ENCONTRADO.
                  </td>
                </tr>
              ) : (
                titulosFiltrados.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.tipo}</td>
                    <td className="p-3">
                      <div className="font-bold">{t.descricao}</div>
                      <div className="text-xs text-[#6C757D]">
                        {t.documento || "-"} • {t.categoria || "-"}
                      </div>
                    </td>
                    <td className="p-3">{t.clienteNome || "-"}</td>
                    <td className="p-3">{t.dataVencimento || "-"}</td>
                    <td className="p-3">
                      <span
                        className={
                          t.statusCalc === "PAGO"
                            ? "font-bold text-green-700"
                            : t.statusCalc === "VENCIDO"
                            ? "font-bold text-red-600"
                            : t.statusCalc === "PARCIAL"
                            ? "font-bold text-orange-600"
                            : "font-bold text-[#0A569E]"
                        }
                      >
                        {t.statusCalc}
                      </span>
                    </td>
                    <td className="p-3 text-right">{moneyBR(t.valorLiquido)}</td>
                    <td className="p-3 text-right">{moneyBR(toMoney(t.valorPago))}</td>
                    <td className="p-3 text-right font-bold">{moneyBR(t.saldoAberto)}</td>
                    <td className="p-3 text-right">
                      {t.tipo === "RECEBER" && t.statusCalc !== "PAGO" && t.statusCalc !== "CANCELADO" ? (
                        <button
                          onClick={() => abrirRecebimento(t)}
                          className="border px-3 py-1 rounded"
                          type="button"
                        >
                          RECEBER
                        </button>
                      ) : (
                        <span className="text-xs text-[#6C757D]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
