"use client";

type PaginationProps = {
  page: number;
  setPage: (page: number) => void;
  total: number;
  pageSize?: number;
};

export default function Pagination({
  page,
  setPage,
  total,
  pageSize = 50,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function goTo(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setPage(pageNumber);
  }

  function renderPages() {
    const pages: number[] = [];

    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  return (
    <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="text-sm text-[#6C757D]">
        MOSTRANDO <b>{start}</b> ATÉ <b>{end}</b> DE <b>{total}</b> REGISTROS
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => goTo(1)}
          disabled={page === 1}
          className="botao-paginacao"
        >
          PRIMEIRA
        </button>

        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          className="botao-paginacao"
        >
          ANTERIOR
        </button>

        {renderPages().map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => goTo(p)}
            className={`botao-paginacao ${p === page ? "ativo" : ""}`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages}
          className="botao-paginacao"
        >
          PRÓXIMA
        </button>

        <button
          type="button"
          onClick={() => goTo(totalPages)}
          disabled={page === totalPages}
          className="botao-paginacao"
        >
          ÚLTIMA
        </button>
      </div>

      <style jsx>{`
        .botao-paginacao {
          border: 1px solid #2f2f2f;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          background: white;
          color: #1f1f1f;
          font-weight: 600;
          min-width: 42px;
        }

        .botao-paginacao:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .botao-paginacao.ativo {
          background: #0456a3;
          color: white;
          border-color: #0456a3;
        }
      `}</style>
    </div>
  );
}