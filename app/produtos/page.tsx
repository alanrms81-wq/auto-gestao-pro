"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";
import { canAccess } from "@/lib/authGuard";

type SessionUser = {
  id?: string;
  empresa_id: string;
  role?: string | null;
};

type Produto = {
  id: string;
  empresa_id: string;
  nome: string;
  codigo_sku?: string | null;
  codigo_barras?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  preco_balcao?: number | null;
  preco_instalacao?: number | null;
  preco_revenda?: number | null;
  estoque_atual?: number | null;
  estoque_minimo?: number | null;
  controla_estoque?: boolean | null;
  status?: string | null;
  tipo_produto?: string | null;
  unidade_medida?: string | null;
  controla_composicao?: boolean | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type ProdutoComposicao = {
  id?: string;
  produto_item_id: string;
  quantidade: number;
  unidade_medida?: string | null;
  observacoes?: string | null;
  produto_item_nome?: string;
  produto_item_sku?: string;
  estoque_atual?: number;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ProdutosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [codigoSku, setCodigoSku] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [precoBalcao, setPrecoBalcao] = useState("");
  const [precoInstalacao, setPrecoInstalacao] = useState("");
  const [precoRevenda, setPrecoRevenda] = useState("");
  const [estoqueAtual, setEstoqueAtual] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [controlaEstoque, setControlaEstoque] = useState(true);
  const [status, setStatus] = useState("ATIVO");
  const [tipoProduto, setTipoProduto] = useState("SIMPLES");
  const [unidadeMedida, setUnidadeMedida] = useState("UN");
  const [observacoes, setObservacoes] = useState("");

  const [produtoBuscaComponente, setProdutoBuscaComponente] = useState("");
  const [produtoComponenteId, setProdutoComponenteId] = useState("");
  const [quantidadeComponente, setQuantidadeComponente] = useState("");
  const [unidadeComponente, setUnidadeComponente] = useState("UN");
  const [obsComponente, setObsComponente] = useState("");
  const [composicao, setComposicao] = useState<ProdutoComposicao[]>([]);

  useEffect(() => {
    async function init() {
      const user = (await getSessionUser()) as SessionUser | null;

      if (!user) {
        router.push("/login");
        return;
      }

      const role = String(user.role || "").toUpperCase();
      const isMaster = role === "MASTER";
      const isAdmin = role === "ADMIN";

      if (!isMaster && !isAdmin && !canAccess("PRODUTOS")) {
        router.push("/dashboard");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarBase(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarBase(empId?: string) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("empresa_id", eid)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR PRODUTOS: " + error.message);
      setProdutos([]);
      setLoading(false);
      return;
    }

    setProdutos((data || []) as Produto[]);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setNome("");
    setCodigoSku("");
    setCodigoBarras("");
    setCategoria("");
    setSubcategoria("");
    setPrecoBalcao("");
    setPrecoInstalacao("");
    setPrecoRevenda("");
    setEstoqueAtual("");
    setEstoqueMinimo("");
    setControlaEstoque(true);
    setStatus("ATIVO");
    setTipoProduto("SIMPLES");
    setUnidadeMedida("UN");
    setObservacoes("");
    setProdutoBuscaComponente("");
    setProdutoComponenteId("");
    setQuantidadeComponente("");
    setUnidadeComponente("UN");
    setObsComponente("");
    setComposicao([]);
  }

  function abrirNovoProduto() {
    resetForm();
    setModalAberto(true);
  }

  async function editarProduto(produto: Produto) {
    setEditingId(produto.id);
    setNome(produto.nome || "");
    setCodigoSku(produto.codigo_sku || "");
    setCodigoBarras(produto.codigo_barras || "");
    setCategoria(produto.categoria || "");
    setSubcategoria(produto.subcategoria || "");
    setPrecoBalcao(String(toMoney(produto.preco_balcao)));
    setPrecoInstalacao(String(toMoney(produto.preco_instalacao)));
    setPrecoRevenda(String(toMoney(produto.preco_revenda)));
    setEstoqueAtual(String(toMoney(produto.estoque_atual)));
    setEstoqueMinimo(String(toMoney(produto.estoque_minimo)));
    setControlaEstoque(!!produto.controla_estoque);
    setStatus(produto.status || "ATIVO");
    setTipoProduto(produto.tipo_produto || "SIMPLES");
    setUnidadeMedida(produto.unidade_medida || "UN");
    setObservacoes(produto.observacoes || "");
    setComposicao([]);

    if ((produto.tipo_produto || "SIMPLES") === "COMPOSTO") {
      const { data, error } = await supabase
        .from("produtos_composicao")
        .select("*")
        .eq("empresa_id", produto.empresa_id)
        .eq("produto_pai_id", produto.id);

      if (error) {
        alert("ERRO AO CARREGAR COMPOSIÇÃO: " + error.message);
      } else {
        const ids = (data || []).map((item: any) => item.produto_item_id);
        let mapa = new Map<string, Produto>();

        if (ids.length > 0) {
          const { data: itensProdutos } = await supabase
            .from("produtos")
            .select("id,nome,codigo_sku,estoque_atual")
            .in("id", ids);

          mapa = new Map((itensProdutos || []).map((p: any) => [p.id, p]));
        }

        setComposicao(
          (data || []).map((item: any) => ({
            id: item.id,
            produto_item_id: item.produto_item_id,
            quantidade: Number(item.quantidade || 0),
            unidade_medida: item.unidade_medida || "UN",
            observacoes: item.observacoes || "",
            produto_item_nome: mapa.get(item.produto_item_id)?.nome || "ITEM",
            produto_item_sku: mapa.get(item.produto_item_id)?.codigo_sku || "",
            estoque_atual: Number(mapa.get(item.produto_item_id)?.estoque_atual || 0),
          }))
        );
      }
    }

    setModalAberto(true);
  }

  async function removerProduto(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE PRODUTO?")) return;

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);

    if (error) {
      alert("ERRO AO REMOVER PRODUTO: " + error.message);
      return;
    }

    alert("PRODUTO REMOVIDO!");
    await carregarBase();
  }

  const produtosFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return produtos;

    return produtos.filter((p) =>
      up(
        `${p.nome || ""} ${p.codigo_sku || ""} ${p.codigo_barras || ""} ${p.categoria || ""} ${p.subcategoria || ""} ${p.tipo_produto || ""} ${p.status || ""}`
      ).includes(q)
    );
  }, [produtos, busca]);

  const produtosComponentesDisponiveis = useMemo(() => {
    const q = up(produtoBuscaComponente.trim());

    return produtos
      .filter((p) => p.id !== editingId)
      .filter((p) => up(p.status || "ATIVO") !== "INATIVO")
      .filter((p) => {
        if (!q) return true;
        return up(
          `${p.nome || ""} ${p.codigo_sku || ""} ${p.codigo_barras || ""} ${p.categoria || ""}`
        ).includes(q);
      })
      .slice(0, 20);
  }, [produtos, produtoBuscaComponente, editingId]);

  function adicionarComponente() {
    if (!produtoComponenteId) {
      alert("SELECIONE O PRODUTO COMPONENTE.");
      return;
    }

    const qtd = Number(quantidadeComponente || 0);

    if (qtd <= 0) {
      alert("INFORME A QUANTIDADE DO COMPONENTE.");
      return;
    }

    const produto = produtos.find((p) => p.id === produtoComponenteId);

    if (!produto) {
      alert("COMPONENTE NÃO ENCONTRADO.");
      return;
    }

    const existente = composicao.find((c) => c.produto_item_id === produtoComponenteId);

    if (existente) {
      setComposicao((prev) =>
        prev.map((c) =>
          c.produto_item_id === produtoComponenteId
            ? {
                ...c,
                quantidade: Number(c.quantidade || 0) + qtd,
                unidade_medida: unidadeComponente,
                observacoes: obsComponente || c.observacoes || "",
              }
            : c
        )
      );
    } else {
      setComposicao((prev) => [
        ...prev,
        {
          produto_item_id: produtoComponenteId,
          quantidade: qtd,
          unidade_medida: unidadeComponente,
          observacoes: obsComponente,
          produto_item_nome: produto.nome,
          produto_item_sku: produto.codigo_sku || "",
          estoque_atual: Number(produto.estoque_atual || 0),
        },
      ]);
    }

    setProdutoBuscaComponente("");
    setProdutoComponenteId("");
    setQuantidadeComponente("");
    setUnidadeComponente("UN");
    setObsComponente("");
  }

  function removerComponente(produtoItemId: string) {
    setComposicao((prev) => prev.filter((c) => c.produto_item_id !== produtoItemId));
  }

  async function salvarProduto() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME DO PRODUTO.");
      return;
    }

    if (tipoProduto === "COMPOSTO" && composicao.length === 0) {
      alert("PRODUTO COMPOSTO PRECISA TER PELO MENOS 1 COMPONENTE.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome),
      codigo_sku: up(codigoSku),
      codigo_barras: codigoBarras.trim(),
      categoria: up(categoria),
      subcategoria: up(subcategoria),
      preco_balcao: toMoney(precoBalcao),
      preco_instalacao: toMoney(precoInstalacao),
      preco_revenda: toMoney(precoRevenda),
      estoque_atual: toMoney(estoqueAtual),
      estoque_minimo: toMoney(estoqueMinimo),
      controla_estoque: controlaEstoque,
      status: up(status),
      tipo_produto: up(tipoProduto),
      unidade_medida: up(unidadeMedida),
      controla_composicao: tipoProduto === "COMPOSTO",
      observacoes: up(observacoes),
    };

    let produtoId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("produtos")
        .update(payload)
        .eq("empresa_id", empresaId)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR PRODUTO: " + error.message);
        return;
      }

      const { error: delError } = await supabase
        .from("produtos_composicao")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("produto_pai_id", editingId);

      if (delError) {
        alert("PRODUTO SALVO, MAS ERRO AO LIMPAR COMPOSIÇÃO: " + delError.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("produtos")
        .insert([payload])
        .select("id")
        .single();

      if (error || !data) {
        alert("ERRO AO CRIAR PRODUTO: " + (error?.message || ""));
        return;
      }

      produtoId = data.id;
    }

    if (tipoProduto === "COMPOSTO" && produtoId) {
      const composicaoPayload = composicao.map((item) => ({
        empresa_id: empresaId,
        produto_pai_id: produtoId,
        produto_item_id: item.produto_item_id,
        quantidade: Number(item.quantidade || 0),
        unidade_medida: up(item.unidade_medida || "UN"),
        observacoes: up(item.observacoes || ""),
      }));

      const { error } = await supabase
        .from("produtos_composicao")
        .insert(composicaoPayload);

      if (error) {
        alert("PRODUTO SALVO, MAS ERRO AO SALVAR COMPOSIÇÃO: " + error.message);
        return;
      }
    }

    alert(editingId ? "PRODUTO ATUALIZADO!" : "PRODUTO CRIADO!");
    setModalAberto(false);
    resetForm();
    await carregarBase();
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 rounded-[26px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-[0.2em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[28px] md:text-[34px] font-black leading-none">
                PRODUTOS
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRO COM MODAL, PRODUTO SIMPLES E PRODUTO COMPOSTO
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="TOTAL" valor={String(produtos.length)} />
              <KpiMini
                titulo="COMPOSTOS"
                valor={String(produtos.filter((p) => up(p.tipo_produto || "SIMPLES") === "COMPOSTO").length)}
              />
              <KpiMini
                titulo="ATIVOS"
                valor={String(produtos.filter((p) => up(p.status || "ATIVO") === "ATIVO").length)}
              />
              <KpiMini titulo="ESTOQUE BAIXO" valor={String(produtos.filter((p) => toMoney(p.estoque_atual) <= toMoney(p.estoque_minimo)).length)} destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={abrirNovoProduto} className="botao-header-primary" type="button">
              NOVO PRODUTO
            </button>

            <input
              placeholder="BUSCAR PRODUTO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[48px] w-[320px] xl:w-[420px] max-w-full rounded-2xl border border-white/20 bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/70"
            />
          </div>
        </div>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">PRODUTOS CADASTRADOS</h2>
              <p className="section-subtitle">
                Gerencie itens simples e compostos com baixa automática.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1300px]">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>SKU</th>
                  <th>CATEGORIA</th>
                  <th>TIPO</th>
                  <th>UNIDADE</th>
                  <th>PREÇO BALCÃO</th>
                  <th>ESTOQUE</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      NENHUM PRODUTO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  produtosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.nome || "-"}</td>
                      <td>{item.codigo_sku || "-"}</td>
                      <td>
                        {item.categoria || "-"}
                        {item.subcategoria ? ` / ${item.subcategoria}` : ""}
                      </td>
                      <td>{item.tipo_produto || "SIMPLES"}</td>
                      <td>{item.unidade_medida || "UN"}</td>
                      <td>{moneyBR(toMoney(item.preco_balcao))}</td>
                      <td>{toMoney(item.estoque_atual)}</td>
                      <td>{item.status || "-"}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarProduto(item)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerProduto(item.id)}
                            className="botao-mini danger"
                            type="button"
                          >
                            REMOVER
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {modalAberto && (
          <div className="modal-overlay" onClick={() => setModalAberto(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-kicker">AUTO GESTÃO PRO</div>
                  <h2 className="modal-title">
                    {editingId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>

              <div className="modal-scroll">
                <div className="card-interno">
                  <h3 className="section-title mb-4">DADOS DO PRODUTO</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label">NOME</label>
                      <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">SKU</label>
                      <input className="campo" value={codigoSku} onChange={(e) => setCodigoSku(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">CÓDIGO DE BARRAS</label>
                      <input className="campo" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">CATEGORIA</label>
                      <input className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">SUBCATEGORIA</label>
                      <input className="campo" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">TIPO DO PRODUTO</label>
                      <select className="campo" value={tipoProduto} onChange={(e) => setTipoProduto(e.target.value)}>
                        <option value="SIMPLES">SIMPLES</option>
                        <option value="COMPOSTO">COMPOSTO</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">UNIDADE</label>
                      <select className="campo" value={unidadeMedida} onChange={(e) => setUnidadeMedida(e.target.value)}>
                        <option value="UN">UN</option>
                        <option value="MT">MT</option>
                        <option value="M2">M2</option>
                        <option value="KG">KG</option>
                        <option value="LT">LT</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">PREÇO BALCÃO</label>
                      <input type="number" step="0.01" className="campo" value={precoBalcao} onChange={(e) => setPrecoBalcao(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">PREÇO INSTALAÇÃO</label>
                      <input type="number" step="0.01" className="campo" value={precoInstalacao} onChange={(e) => setPrecoInstalacao(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">PREÇO REVENDA</label>
                      <input type="number" step="0.01" className="campo" value={precoRevenda} onChange={(e) => setPrecoRevenda(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">STATUS</label>
                      <select className="campo" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="ATIVO">ATIVO</option>
                        <option value="INATIVO">INATIVO</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">ESTOQUE ATUAL</label>
                      <input type="number" step="0.0001" className="campo" value={estoqueAtual} onChange={(e) => setEstoqueAtual(e.target.value)} />
                    </div>

                    <div>
                      <label className="label">ESTOQUE MÍNIMO</label>
                      <input type="number" step="0.0001" className="campo" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} />
                    </div>

                    <div className="md:col-span-2">
                      <label className="checkbox-box">
                        <input
                          type="checkbox"
                          checked={controlaEstoque}
                          onChange={(e) => setControlaEstoque(e.target.checked)}
                        />
                        <span>CONTROLA ESTOQUE</span>
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">OBSERVAÇÕES</label>
                      <textarea className="campo-textarea" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                    </div>
                  </div>
                </div>

                {tipoProduto === "COMPOSTO" && (
                  <div className="card-interno mt-5">
                    <h3 className="section-title mb-4">COMPOSIÇÃO DO PRODUTO</h3>

                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_130px_120px] gap-3">
                      <div>
                        <label className="label">BUSCAR COMPONENTE</label>
                        <input
                          className="campo"
                          placeholder="NOME, SKU, CÓDIGO..."
                          value={produtoBuscaComponente}
                          onChange={(e) => setProdutoBuscaComponente(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="label">QTD</label>
                        <input
                          type="number"
                          step="0.0001"
                          className="campo"
                          value={quantidadeComponente}
                          onChange={(e) => setQuantidadeComponente(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="label">UNIDADE</label>
                        <select
                          className="campo"
                          value={unidadeComponente}
                          onChange={(e) => setUnidadeComponente(e.target.value)}
                        >
                          <option value="UN">UN</option>
                          <option value="MT">MT</option>
                          <option value="M2">M2</option>
                          <option value="KG">KG</option>
                          <option value="LT">LT</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 max-h-[220px] overflow-auto rounded-[16px] border border-[#E5E7EB] bg-white">
                      {produtosComponentesDisponiveis.length === 0 ? (
                        <div className="p-4 text-sm text-[#64748B]">
                          NENHUM COMPONENTE ENCONTRADO.
                        </div>
                      ) : (
                        produtosComponentesDisponiveis.map((p) => {
                          const selected = produtoComponenteId === p.id;

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setProdutoComponenteId(p.id)}
                              className={`w-full text-left px-4 py-3 border-b border-[#EEF2F7] last:border-b-0 ${
                                selected ? "bg-[#EFF6FF]" : "bg-white hover:bg-[#F8FAFC]"
                              }`}
                            >
                              <div className="font-bold text-[#0F172A]">{p.nome}</div>
                              <div className="text-xs text-[#64748B]">
                                SKU: {p.codigo_sku || "-"} • ESTOQUE: {toMoney(p.estoque_atual)} • TIPO:{" "}
                                {p.tipo_produto || "SIMPLES"}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3">
                      <label className="label">OBS. DO COMPONENTE</label>
                      <input
                        className="campo"
                        value={obsComponente}
                        onChange={(e) => setObsComponente(e.target.value)}
                      />
                    </div>

                    <div className="mt-4">
                      <button onClick={adicionarComponente} className="botao-azul" type="button">
                        ADICIONAR COMPONENTE
                      </button>
                    </div>

                    <div className="mt-5 overflow-auto">
                      <table className="tabela min-w-[900px]">
                        <thead>
                          <tr>
                            <th>COMPONENTE</th>
                            <th>SKU</th>
                            <th>QTD</th>
                            <th>UNIDADE</th>
                            <th>ESTOQUE</th>
                            <th>OBS.</th>
                            <th>AÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {composicao.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="empty-state">
                                NENHUM COMPONENTE ADICIONADO.
                              </td>
                            </tr>
                          ) : (
                            composicao.map((c) => (
                              <tr key={c.produto_item_id}>
                                <td className="font-bold">{c.produto_item_nome || "-"}</td>
                                <td>{c.produto_item_sku || "-"}</td>
                                <td>{Number(c.quantidade || 0).toLocaleString("pt-BR")}</td>
                                <td>{c.unidade_medida || "UN"}</td>
                                <td>{Number(c.estoque_atual || 0).toLocaleString("pt-BR")}</td>
                                <td>{c.observacoes || "-"}</td>
                                <td>
                                  <button
                                    onClick={() => removerComponente(c.produto_item_id)}
                                    className="botao-mini danger"
                                    type="button"
                                  >
                                    REMOVER
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button onClick={salvarProduto} className="botao-azul" type="button">
                  {editingId ? "SALVAR ALTERAÇÕES" : "CRIAR PRODUTO"}
                </button>

                <button
                  onClick={() => {
                    setModalAberto(false);
                    resetForm();
                  }}
                  className="botao"
                  type="button"
                >
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          border: 1px solid #eef2f7;
        }

        .card-interno {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 18px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .section-title {
          font-weight: 900;
          font-size: 15px;
          color: #334155;
        }

        .section-subtitle {
          margin-top: 4px;
          font-size: 12px;
          color: #64748b;
        }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .campo {
          height: 46px;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
          background: white;
          color: #0f172a;
          outline: none;
        }

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          min-height: 100px;
          width: 100%;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          background: white;
          color: #0f172a;
          outline: none;
          resize: vertical;
        }

        .checkbox-box {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 14px;
          height: 46px;
          background: white;
        }

        .botao-header-primary {
          border: none;
          background: white;
          color: #0456a3;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
        }

        .botao-azul {
          border: none;
          background: #0456a3;
          color: white;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
        }

        .botao {
          border: 1px solid #cbd5e1;
          background: white;
          color: #1e293b;
          font-weight: 800;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
        }

        .botao-mini {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 11px;
          background: white;
          color: #1e293b;
          font-weight: 700;
        }

        .botao-mini.danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .tabela {
          width: 100%;
          border-collapse: collapse;
        }

        .tabela th {
          text-align: left;
          font-size: 12px;
          padding: 13px 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
          font-weight: 900;
          background: #f8fafc;
        }

        .tabela td {
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: middle;
        }

        .empty-state {
          text-align: center;
          padding: 28px 12px;
          color: #64748b;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 18px;
        }

        .modal-box {
          width: min(1200px, 100%);
          max-height: 92vh;
          overflow: hidden;
          border-radius: 28px;
          background: #f8fafc;
          box-shadow: 0 30px 90px rgba(15, 23, 42, 0.32);
          border: 1px solid #dbe4ee;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 18px 20px;
          background: linear-gradient(135deg, #0456a3 0%, #0a6fd6 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .modal-kicker {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          opacity: 0.82;
        }

        .modal-title {
          margin-top: 4px;
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
        }

        .close-btn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.24);
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 16px;
          font-weight: 900;
        }

        .modal-scroll {
          padding: 18px;
          overflow: auto;
          flex: 1;
        }

        .modal-footer {
          padding: 16px 18px 18px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          border-top: 1px solid #e5e7eb;
          background: white;
        }
      `}</style>
    </div>
  );
}

function KpiMini({
  titulo,
  valor,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] px-4 py-3 ${
        destaque ? "bg-white text-[#0456A3]" : "bg-white/12 text-white border border-white/15"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] opacity-80">{titulo}</div>
      <div className="mt-1 text-[18px] font-black leading-none">{valor}</div>
    </div>
  );
}