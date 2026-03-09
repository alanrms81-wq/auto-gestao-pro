"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Cliente = {
  id: string;
};

type Produto = {
  id: string;
  nome: string;
  estoque_atual?: number | null;
  estoque_minimo?: number | null;
  controla_estoque?: boolean | null;
};

type OrdemServico = {
  id: string;
  numero?: string | null;
  cliente_nome?: string | null;
  veiculo_descricao?: string | null;
  status?: string | null;
  total?: number | null;
  faturado?: boolean | null;
  created_at?: string | null;
  data_faturamento?: string | null;
};

type FinanceiroTitulo = {
  id: string;
  tipo: "RECEBER" | "PAGAR";
  descricao?: string | null;
  cliente_nome?: string | null;
  valor_original?: number | null;
  valor_pago?: number | null;
  desconto?: number | null;
  juros?: number | null;
  multa?: number | null;
  data_emissao?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string | null;
};

type MovimentacaoEstoque = {
  id: string;
  tipo?: string | null;
  quantidade?: number | null;
  created_at?: string | null;
};

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
    toMoney(t.valor_original) +
    toMoney(t.juros) +
    toMoney(t.multa) -
    toMoney(t.desconto)
  );
}

function saldoAbertoTitulo(t: FinanceiroTitulo) {
  return Math.max(0, valorLiquidoTitulo(t) - toMoney(t.valor_pago));
}

function statusFinanceiro(t: FinanceiroTitulo) {
  const manual = up(t.status || "");

  if (manual === "CANCELADO") return "CANCELADO";

  const saldo = saldoAbertoTitulo(t);

  if (saldo <= 0) return "PAGO";
  if (toMoney(t.valor_pago) > 0) return "PARCIAL";
  if (t.data_vencimento && t.data_vencimento < hojeISO()) return "VENCIDO";
  return "ABERTO";
}

function monthKey(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);

  return dt
    .toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    })
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
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [titulos, setTitulos] = useState<FinanceiroTitulo[]>([]);
  const [movsEstoque, setMovsEstoque] = useState<MovimentacaoEstoque[]>([]);

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarBase(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarBase(empId: string) {
    const [clientesResp, produtosResp, ordensResp, titulosResp, estoqueResp] =
      await Promise.all([
        supabase.from("clientes").select("id").eq("empresa_id", empId),
        supabase
          .from("produtos")
          .select("id,nome,estoque_atual,estoque_minimo,controla_estoque")
          .eq("empresa_id", empId),
        supabase
          .from("ordens_servico")
          .select("id,numero,cliente_nome,veiculo_descricao,status,total,faturado,created_at,data_faturamento")
          .eq("empresa_id", empId),
        supabase
          .from("financeiro_titulos")
          .select(
            "id,tipo,descricao,cliente_nome,valor_original,valor_pago,desconto,juros,multa,data_emissao,data_vencimento,data_pagamento,status"
          )
          .eq("empresa_id", empId),
        supabase
          .from("movimentacoes_estoque")
          .select("id,tipo,quantidade,created_at")
          .eq("empresa_id", empId),
      ]);

    if (clientesResp.error) alert("ERRO CLIENTES: " + clientesResp.error.message);
    if (produtosResp.error) alert("ERRO PRODUTOS: " + produtosResp.error.message);
    if (ordensResp.error) alert("ERRO ORDENS: " + ordensResp.error.message);
    if (titulosResp.error) alert("ERRO FINANCEIRO: " + titulosResp.error.message);
    if (estoqueResp.error) alert("ERRO ESTOQUE: " + estoqueResp.error.message);

    setClientes((clientesResp.data || []) as Cliente[]);
    setProdutos((produtosResp.data || []) as Produto[]);
    setOrdens((ordensResp.data || []) as OrdemServico[]);
    setTitulos((titulosResp.data || []) as FinanceiroTitulo[]);
    setMovsEstoque((estoqueResp.data || []) as MovimentacaoEstoque[]);
  }

  const clientesTotal = useMemo(() => clientes.length, [clientes]);
  const produtosTotal = useMemo(() => produtos.length, [produtos]);

  const osAbertas = useMemo(
    () => ordens.filter((o) => up(o.status) === "ABERTA").length,
    [ordens]
  );

  const osAndamento = useMemo(
    () => ordens.filter((o) => up(o.status) === "EM ANDAMENTO").length,
    [ordens]
  );

  const osFinalizadas = useMemo(
    () => ordens.filter((o) => up(o.status) === "FINALIZADA").length,
    [ordens]
  );

  const osEntregues = useMemo(
    () => ordens.filter((o) => up(o.status) === "ENTREGUE").length,
    [ordens]
  );

  const vendasMes = useMemo(() => {
    const inicio = inicioMesISO();
    return ordens
      .filter((o) => !!o.faturado)
      .filter((o) => (o.data_faturamento || "").slice(0, 10) >= inicio)
      .reduce((acc, o) => acc + toMoney(o.total), 0);
  }, [ordens]);

  const ticketMedio = useMemo(() => {
    const faturadas = ordens.filter((o) => !!o.faturado);
    if (faturadas.length === 0) return 0;
    const total = faturadas.reduce((acc, o) => acc + toMoney(o.total), 0);
    return total / faturadas.length;
  }, [ordens]);

  const aReceber = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => ["ABERTO", "PARCIAL", "VENCIDO"].includes(statusFinanceiro(t)))
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  const aPagar = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "PAGAR")
      .filter((t) => ["ABERTO", "PARCIAL", "VENCIDO"].includes(statusFinanceiro(t)))
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  const recebidoMes = useMemo(() => {
    const inicio = inicioMesISO();
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => (t.data_pagamento || "") >= inicio)
      .reduce((acc, t) => acc + toMoney(t.valor_pago), 0);
  }, [titulos]);

  const vencido = useMemo(() => {
    return titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => statusFinanceiro(t) === "VENCIDO")
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);
  }, [titulos]);

  const estoqueBaixoLista = useMemo(() => {
    return produtos
      .filter(
        (p) =>
          !!p.controla_estoque &&
          toMoney(p.estoque_atual) <= toMoney(p.estoque_minimo)
      )
      .sort((a, b) => toMoney(a.estoque_atual) - toMoney(b.estoque_atual))
      .slice(0, 8);
  }, [produtos]);

  const estoqueBaixo = useMemo(() => estoqueBaixoLista.length, [estoqueBaixoLista]);

  const movimentacoesMes = useMemo(() => {
    const inicio = inicioMesISO();
    return movsEstoque.filter((m) => (m.created_at || "").slice(0, 10) >= inicio).length;
  }, [movsEstoque]);

  const ultimosTitulos = useMemo(() => {
    return [...titulos]
      .sort((a, b) => String(b.data_emissao || "").localeCompare(String(a.data_emissao || "")))
      .slice(0, 8);
  }, [titulos]);

  const ultimasOrdens = useMemo(() => {
    return [...ordens]
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 8);
  }, [ordens]);

  const graficoMeses = useMemo(() => {
    const meses = last6MonthKeys();

    return meses.map((mes) => {
      const totalFaturado = ordens
        .filter((o) => monthKey(o.data_faturamento || o.created_at) === mes)
        .filter((o) => !!o.faturado)
        .reduce((acc, o) => acc + toMoney(o.total), 0);

      const totalRecebido = titulos
        .filter((t) => monthKey(t.data_pagamento) === mes)
        .reduce((acc, t) => acc + toMoney(t.valor_pago), 0);

      const totalSaidaEstoque = movsEstoque
        .filter((m) => monthKey(m.created_at) === mes)
        .filter((m) => up(m.tipo) === "SAIDA")
        .reduce((acc, m) => acc + toMoney(m.quantidade), 0);

      return {
        mes,
        label: monthLabel(mes),
        faturado: totalFaturado,
        recebido: totalRecebido,
        saidaEstoque: totalSaidaEstoque,
      };
    });
  }, [ordens, titulos, movsEstoque]);

  const maxGraficoFinanceiro = useMemo(() => {
    return Math.max(1, ...graficoMeses.flatMap((m) => [m.faturado, m.recebido]));
  }, [graficoMeses]);

  const maxGraficoEstoque = useMemo(() => {
    return Math.max(1, ...graficoMeses.map((m) => m.saidaEstoque));
  }, [graficoMeses]);

  const cardsResumo = [
    { titulo: "CLIENTES", valor: String(clientesTotal) },
    { titulo: "PRODUTOS", valor: String(produtosTotal) },
    { titulo: "OS ABERTAS", valor: String(osAbertas) },
    { titulo: "OS EM ANDAMENTO", valor: String(osAndamento) },
    { titulo: "OS FINALIZADAS", valor: String(osFinalizadas) },
    { titulo: "OS ENTREGUES", valor: String(osEntregues) },
    { titulo: "FATURAMENTO MÊS", valor: moneyBR(vendasMes) },
    { titulo: "TICKET MÉDIO", valor: moneyBR(ticketMedio) },
    { titulo: "A RECEBER", valor: moneyBR(aReceber) },
    { titulo: "A PAGAR", valor: moneyBR(aPagar) },
    { titulo: "RECEBIDO MÊS", valor: moneyBR(recebidoMes) },
    { titulo: "VENCIDO", valor: moneyBR(vencido) },
    { titulo: "ESTOQUE BAIXO", valor: String(estoqueBaixo) },
    { titulo: "MOV. ESTOQUE MÊS", valor: String(movimentacoesMes) },
  ];

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-black text-[#6C757D]">
              DASHBOARD ERP
            </h1>
            <p className="text-sm text-[#6C757D] mt-1">
              VISÃO OPERACIONAL, FATURAMENTO, RECEBIMENTO E ESTOQUE
            </p>
          </div>

          <div className="card !p-4">
            <div className="text-sm text-[#6C757D]">
              ATUALIZADO EM: <b>{new Date().toLocaleString("pt-BR")}</b>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4 mb-6">
          {cardsResumo.map((item) => (
            <CardKpi key={item.titulo} titulo={item.titulo} valor={item.valor} />
          ))}
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.5fr_1fr] gap-6 mb-6">
          <section className="card">
            <h2 className="titulo-azul mb-5">FATURADO X RECEBIDO</h2>

            <div className="space-y-6">
              {graficoMeses.map((item) => (
                <div key={item.mes}>
                  <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
                    <div className="font-black text-[#111827]">{item.label}</div>
                    <div className="text-sm text-[#6B7280]">
                      VENDAS {moneyBR(item.faturado)} • OS {moneyBR(item.faturado)} • RECEBIDO {moneyBR(item.recebido)}
                    </div>
                  </div>

                  <Barra label="VENDAS" valor={item.faturado} max={maxGraficoFinanceiro} />
                  <Barra label="OS FATURADAS" valor={item.faturado} max={maxGraficoFinanceiro} />
                  <Barra label="RECEBIDO" valor={item.recebido} max={maxGraficoFinanceiro} />
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="titulo-azul mb-5">FUNIL OPERACIONAL</h2>

            <ResumoLinha label="ABERTAS" valor={String(osAbertas)} />
            <ResumoLinha label="ANDAMENTO" valor={String(osAndamento)} />
            <ResumoLinha label="FINALIZADAS" valor={String(osFinalizadas)} />
            <ResumoLinha label="ENTREGUES" valor={String(osEntregues)} />
          </section>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-6">
          <section className="card">
            <h2 className="titulo-azul mb-5">SAÍDA DE ESTOQUE POR MÊS</h2>

            <div className="space-y-4">
              {graficoMeses.map((item) => (
                <Barra
                  key={item.mes}
                  label={item.label}
                  valor={item.saidaEstoque}
                  max={maxGraficoEstoque}
                />
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="titulo-azul mb-5">PRODUTOS COM ESTOQUE BAIXO</h2>

            <div className="space-y-3">
              {estoqueBaixoLista.length === 0 ? (
                <div className="text-sm text-[#6B7280]">NENHUM PRODUTO COM ESTOQUE BAIXO.</div>
              ) : (
                estoqueBaixoLista.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b last:border-b-0 pb-2"
                  >
                    <div>
                      <div className="font-semibold text-[#111827]">{p.nome}</div>
                      <div className="text-xs text-[#6B7280]">
                        MÍNIMO: {toMoney(p.estoque_minimo)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-[#111827]">{toMoney(p.estoque_atual)}</div>
                      <div className="text-xs text-[#6B7280]">EM ESTOQUE</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          <section className="card">
            <h2 className="titulo-azul mb-5">ÚLTIMOS TÍTULOS FINANCEIROS</h2>

            <div className="overflow-auto">
              <table className="tabela min-w-[760px]">
                <thead>
                  <tr>
                    <th>TIPO</th>
                    <th>DESCRIÇÃO</th>
                    <th>CLIENTE</th>
                    <th>STATUS</th>
                    <th>VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosTitulos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#6B7280]">
                        NENHUM TÍTULO ENCONTRADO.
                      </td>
                    </tr>
                  ) : (
                    ultimosTitulos.map((t) => (
                      <tr key={t.id}>
                        <td>{t.tipo}</td>
                        <td>{t.descricao || "-"}</td>
                        <td>{t.cliente_nome || "-"}</td>
                        <td>{statusFinanceiro(t)}</td>
                        <td>{moneyBR(valorLiquidoTitulo(t))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="titulo-azul mb-5">ÚLTIMAS ORDENS DE SERVIÇO</h2>

            <div className="overflow-auto">
              <table className="tabela min-w-[760px]">
                <thead>
                  <tr>
                    <th>NÚMERO</th>
                    <th>CLIENTE</th>
                    <th>VEÍCULO</th>
                    <th>STATUS</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasOrdens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#6B7280]">
                        NENHUMA OS ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    ultimasOrdens.map((o) => (
                      <tr key={o.id}>
                        <td>{o.numero || "-"}</td>
                        <td>{o.cliente_nome || "-"}</td>
                        <td>{o.veiculo_descricao || "-"}</td>
                        <td>{o.status || "-"}</td>
                        <td>{moneyBR(toMoney(o.total))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .titulo-azul {
          font-size: 18px;
          font-weight: 900;
          color: #0456a3;
        }

        .tabela {
          width: 100%;
          border-collapse: collapse;
        }

        .tabela th {
          text-align: left;
          font-size: 12px;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
          font-weight: 900;
        }

        .tabela td {
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}

function CardKpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-[22px] shadow-sm p-5 min-h-[110px]">
      <div className="text-[14px] font-bold text-[#6C757D]">{titulo}</div>
      <div className="mt-3 text-[24px] font-black text-[#111] break-words">{valor}</div>
    </div>
  );
}

function Barra({
  label,
  valor,
  max,
}: {
  label: string;
  valor: number;
  max: number;
}) {
  const width = `${Math.max(4, (valor / max) * 100)}%`;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-[#374151]">{label}</span>
        <span className="text-sm font-semibold text-[#111827]">
          {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
        </span>
      </div>

      <div className="w-full h-4 rounded-full bg-[#E5E7EB] overflow-hidden">
        <div className="h-4 rounded-full bg-[#0456A3]" style={{ width }} />
      </div>
    </div>
  );
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between items-center border-b last:border-b-0 py-3">
      <span className="text-[#374151] font-medium">{label}</span>
      <span className="text-[#111827] font-bold">{valor}</span>
    </div>
  );
}