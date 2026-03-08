"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess, isLogged } from "@/lib/authGuard";

type Cliente = {
  id: number;
  nome: string;
  status?: "ATIVO" | "INATIVO";
};

type Produto = {
  id: number;
  nome: string;
  controlaEstoque?: boolean;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  status?: "ATIVO" | "INATIVO";
};

type Venda = {
  id: number;
  numero?: string;
  dataISO?: string;
  clienteNome?: string;
  total?: number;
  status?: string;
};

type OrdemServico = {
  id: number;
  numero?: string;
  dataISO?: string;
  clienteNome?: string;
  veiculoDescricao?: string;
  total?: number;
  status?: string;
  faturado?: boolean;
  dataFaturamento?: string;
};

type FinanceiroTitulo = {
  id: number;
  tipo: "RECEBER" | "PAGAR";
  descricao: string;
  clienteNome?: string;
  valorOriginal: number;
  valorPago: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  status?: string;
  formaPagamento?: string;
};

type FluxoLancamento = {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: number;
  data: string;
};

const LS_CLIENTES = "clientes";
const LS_PRODUTOS = "produtos";
const LS_VENDAS = "vendas";
const LS_ORDENS = "ordensServico";
const LS_TITULOS = "financeiro_titulos";
const LS_FLUXO = "financeiro_lancamentos";

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function up(v: any) {
  return String(v ?? "").toUpperCase();
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

function inicioMesISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
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
  const statusManual = up(t.status || "");

  if (statusManual === "CANCELADO") return "CANCELADO";

  const saldo = saldoAbertoTitulo(t);

  if (saldo <= 0) return "PAGO";
  if (toMoney(t.valorPago) > 0) return "PARCIAL";
  if (t.dataVencimento && t.dataVencimento < hojeISO()) return "VENCIDO";
  return "ABERTO";
}

function monthKey(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .toUpperCase();
}

function last6MonthKeys() {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);

  for (let i = 5; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }

  return out;
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [titulos, setTitulos] = useState<FinanceiroTitulo[]>([]);
  const [fluxo, setFluxo] = useState<FluxoLancamento[]>([]);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("DASHBOARD")) {
      alert("ACESSO NEGADO");
      router.push("/login");
      return;
    }

    setClientes(readLS<Cliente[]>(LS_CLIENTES, []));
    setProdutos(readLS<Produto[]>(LS_PRODUTOS, []));
    setVendas(readLS<Venda[]>(LS_VENDAS, []));
    setOrdens(readLS<OrdemServico[]>(LS_ORDENS, []));
    setTitulos(readLS<FinanceiroTitulo[]>(LS_TITULOS, []));
    setFluxo(readLS<FluxoLancamento[]>(LS_FLUXO, []));
    setReady(true);
  }, [router]);

  const clientesAtivos = useMemo(
    () => clientes.filter((c) => (c.status || "ATIVO") !== "INATIVO").length,
    [clientes]
  );

  const produtosAtivos = useMemo(
    () => produtos.filter((p) => (p.status || "ATIVO") !== "INATIVO").length,
    [produtos]
  );

  const vendasMes = useMemo(() => {
    const inicio = inicioMesISO();
    return vendas
      .filter((v) => (v.dataISO || "") >= inicio)
      .reduce((acc, v) => acc + toMoney(v.total), 0);
  }, [vendas]);

  const faturadoOsMes = useMemo(() => {
    const inicio = inicioMesISO();
    return ordens
      .filter((o) => !!o.faturado)
      .filter((o) => (o.dataFaturamento || "") >= inicio)
      .reduce((acc, o) => acc + toMoney(o.total), 0);
  }, [ordens]);

  const ordensAbertas = useMemo(() => {
    return ordens.filter((o) => {
      const s = String(o.status || "").toUpperCase();
      return s === "ABERTA" || s === "EM ANDAMENTO";
    }).length;
  }, [ordens]);

  const titulosReceber = useMemo(
    () => titulos.filter((t) => t.tipo === "RECEBER"),
    [titulos]
  );

  const titulosPagar = useMemo(
    () => titulos.filter((t) => t.tipo === "PAGAR"),
    [titulos]
  );

  const totalReceberAberto = useMemo(() => {
    return titulosReceber
      .filter((t) => {
        const st = statusFinanceiro(t);
        return st === "ABERTO" || st === "PARCIAL" || st === "VENCIDO";
      })
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulosReceber]);

  const totalPagarAberto = useMemo(() => {
    return titulosPagar
      .filter((t) => {
        const st = statusFinanceiro(t);
        return st === "ABERTO" || st === "PARCIAL" || st === "VENCIDO";
      })
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulosPagar]);

  const totalVencido = useMemo(() => {
    return titulosReceber
      .filter((t) => statusFinanceiro(t) === "VENCIDO")
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulosReceber]);

  const recebidoMes = useMemo(() => {
    const inicio = inicioMesISO();
    return titulosReceber
      .filter((t) => (t.dataPagamento || "") >= inicio)
      .reduce((acc, t) => acc + toMoney(t.valorPago), 0);
  }, [titulosReceber]);

  const saldoCaixa = useMemo(() => {
    return fluxo.reduce((acc, l) => {
      return acc + (l.tipo === "ENTRADA" ? toMoney(l.valor) : -toMoney(l.valor));
    }, 0);
  }, [fluxo]);

  const produtosEstoqueBaixo = useMemo(() => {
    return produtos
      .filter((p) => p.controlaEstoque)
      .filter((p) => toMoney(p.estoqueAtual) <= toMoney(p.estoqueMinimo))
      .slice(0, 8);
  }, [produtos]);

  const vendasRecentes = useMemo(() => {
    return [...vendas]
      .sort((a, b) => (b.dataISO || "").localeCompare(a.dataISO || ""))
      .slice(0, 6);
  }, [vendas]);

  const ordensRecentes = useMemo(() => {
    return [...ordens]
      .sort((a, b) =>
        (b.dataFaturamento || b.dataISO || "").localeCompare(
          a.dataFaturamento || a.dataISO || ""
        )
      )
      .slice(0, 6);
  }, [ordens]);

  const titulosVencidos = useMemo(() => {
    return titulosReceber
      .map((t) => ({ ...t, statusCalc: statusFinanceiro(t) }))
      .filter((t) => t.statusCalc === "VENCIDO")
      .slice(0, 6);
  }, [titulosReceber]);

  const graficoMeses = useMemo(() => {
    const meses = last6MonthKeys();

    return meses.map((mes) => {
      const totalVendas = vendas
        .filter((v) => monthKey(v.dataISO) === mes)
        .reduce((acc, v) => acc + toMoney(v.total), 0);

      const totalOs = ordens
        .filter((o) => monthKey(o.dataFaturamento || o.dataISO) === mes)
        .reduce((acc, o) => acc + toMoney(o.total), 0);

      const recebimentos = fluxo
        .filter((f) => f.tipo === "ENTRADA" && monthKey(f.data) === mes)
        .reduce((acc, f) => acc + toMoney(f.valor), 0);

      return {
        mes,
        label: monthLabel(mes),
        vendas: totalVendas,
        ordens: totalOs,
        entradas: recebimentos,
      };
    });
  }, [vendas, ordens, fluxo]);

  const graficoMax = useMemo(() => {
    const vals = graficoMeses.flatMap((m) => [m.vendas, m.ordens, m.entradas]);
    return Math.max(1, ...vals);
  }, [graficoMeses]);

  const funilOperacional = useMemo(() => {
    const osAbertas = ordens.filter((o) => up(o.status) === "ABERTA").length;
    const osAndamento = ordens.filter((o) => up(o.status) === "EM ANDAMENTO").length;
    const osFinalizadas = ordens.filter((o) => up(o.status) === "FINALIZADA").length;
    const osEntregues = ordens.filter((o) => up(o.status) === "ENTREGUE").length;

    return [
      { label: "ABERTAS", valor: osAbertas },
      { label: "ANDAMENTO", valor: osAndamento },
      { label: "FINALIZADAS", valor: osFinalizadas },
      { label: "ENTREGUES", valor: osEntregues },
    ];
  }, [ordens]);

  const maxFunil = useMemo(() => {
    return Math.max(1, ...funilOperacional.map((f) => f.valor));
  }, [funilOperacional]);

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">DASHBOARD ERP</h1>
            <p className="text-sm text-[#6C757D]">
              VISÃO OPERACIONAL, FATURAMENTO, RECEBIMENTO E INADIMPLÊNCIA
            </p>
          </div>

          <div className="text-sm text-[#6C757D] bg-white rounded-xl shadow px-4 py-3">
            ATUALIZADO EM: <b>{new Date().toLocaleString("pt-BR")}</b>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">CLIENTES</div>
            <div className="text-3xl font-black mt-2">{clientesAtivos}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">PRODUTOS</div>
            <div className="text-3xl font-black mt-2">{produtosAtivos}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">VENDAS MÊS</div>
            <div className="text-xl font-black mt-2">{moneyBR(vendasMes)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">OS FATURADAS MÊS</div>
            <div className="text-xl font-black mt-2">{moneyBR(faturadoOsMes)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">RECEBIDO MÊS</div>
            <div className="text-xl font-black mt-2">{moneyBR(recebidoMes)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">A RECEBER</div>
            <div className="text-xl font-black mt-2">{moneyBR(totalReceberAberto)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">VENCIDO</div>
            <div className="text-xl font-black mt-2">{moneyBR(totalVencido)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">SALDO CAIXA</div>
            <div className="text-xl font-black mt-2">{moneyBR(saldoCaixa)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6 mb-6">
          <div className="2xl:col-span-2 bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">
              FATURADO X RECEBIDO
            </h2>

            <div className="space-y-4">
              {graficoMeses.map((m) => (
                <div key={m.mes}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold">{m.label}</span>
                    <span className="text-[#6C757D]">
                      VENDAS {moneyBR(m.vendas)} • OS {moneyBR(m.ordens)} • RECEBIDO{" "}
                      {moneyBR(m.entradas)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-xs mb-1">VENDAS</div>
                      <div className="w-full h-3 bg-[#EEF2F7] rounded-full overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-[#0A569E]"
                          style={{ width: `${(m.vendas / graficoMax) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs mb-1">OS FATURADAS</div>
                      <div className="w-full h-3 bg-[#EEF2F7] rounded-full overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-[#28A745]"
                          style={{ width: `${(m.ordens / graficoMax) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs mb-1">RECEBIDO</div>
                      <div className="w-full h-3 bg-[#EEF2F7] rounded-full overflow-hidden">
                        <div
                          className="h-3 rounded-full bg-[#FD7E14]"
                          style={{ width: `${(m.entradas / graficoMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">FUNIL OPERACIONAL</h2>

            <div className="space-y-4">
              {funilOperacional.map((f) => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{f.label}</span>
                    <b>{f.valor}</b>
                  </div>
                  <div className="w-full h-3 bg-[#EEF2F7] rounded-full overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-[#0A569E]"
                      style={{ width: `${(f.valor / maxFunil) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">RESUMO ERP</h2>
            <div className="space-y-2 text-sm">
              <div>OS abertas: <b>{ordensAbertas}</b></div>
              <div>A receber: <b>{moneyBR(totalReceberAberto)}</b></div>
              <div>A pagar: <b>{moneyBR(totalPagarAberto)}</b></div>
              <div>Recebido no mês: <b>{moneyBR(recebidoMes)}</b></div>
              <div>Estoque baixo: <b>{produtosEstoqueBaixo.length}</b></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">ALERTAS</h2>
            <div className="space-y-3">
              {titulosVencidos.length === 0 && produtosEstoqueBaixo.length === 0 ? (
                <div className="text-sm text-[#6C757D]">NENHUM ALERTA CRÍTICO.</div>
              ) : (
                <>
                  {titulosVencidos.slice(0, 3).map((t) => (
                    <div key={t.id} className="border rounded-xl p-3">
                      <div className="text-sm font-bold text-red-600">TÍTULO VENCIDO</div>
                      <div className="text-sm">{t.descricao}</div>
                      <div className="text-xs text-[#6C757D]">
                        {t.clienteNome || "-"} • {t.dataVencimento || "-"}
                      </div>
                    </div>
                  ))}

                  {produtosEstoqueBaixo.slice(0, 3).map((p) => (
                    <div key={p.id} className="border rounded-xl p-3">
                      <div className="text-sm font-bold text-orange-600">ESTOQUE BAIXO</div>
                      <div className="text-sm">{p.nome}</div>
                      <div className="text-xs text-[#6C757D]">
                        Atual: {toMoney(p.estoqueAtual)} • Mínimo: {toMoney(p.estoqueMinimo)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">CAIXA</h2>
            <div className="text-3xl font-black">{moneyBR(saldoCaixa)}</div>
            <div className="text-sm text-[#6C757D] mt-2">
              SALDO ACUMULADO COM BASE NOS LANÇAMENTOS DO FLUXO
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">ORDENS RECENTES</h2>
            <div className="space-y-3">
              {ordensRecentes.length === 0 ? (
                <div className="text-sm text-[#6C757D]">NENHUMA OS CADASTRADA.</div>
              ) : (
                ordensRecentes.map((o) => (
                  <div key={o.id} className="border rounded-xl p-3">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-bold">{o.numero || `OS-${o.id}`}</div>
                        <div className="text-sm">{o.clienteNome || "-"}</div>
                        <div className="text-xs text-[#6C757D]">
                          {o.veiculoDescricao || "-"} • {o.status || "-"} •{" "}
                          {o.faturado ? "FATURADA" : "NÃO FATURADA"}
                        </div>
                      </div>
                      <div className="font-bold">{moneyBR(toMoney(o.total))}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-black text-[#0A569E] mb-4">TÍTULOS VENCIDOS</h2>
            <div className="space-y-3">
              {titulosVencidos.length === 0 ? (
                <div className="text-sm text-[#6C757D]">NENHUM TÍTULO VENCIDO.</div>
              ) : (
                titulosVencidos.map((t) => (
                  <div key={t.id} className="border rounded-xl p-3">
                    <div className="font-bold">{t.descricao}</div>
                    <div className="text-sm">{t.clienteNome || "-"}</div>
                    <div className="text-xs text-[#6C757D]">
                      VENC.: {t.dataVencimento || "-"} • SALDO: {moneyBR(saldoAbertoTitulo(t))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
