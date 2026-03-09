"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";
import { useRouter } from "next/navigation";

type BackupItem = {
  name: string;
  path: string;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BackupListResponse = {
  backups?: BackupItem[];
  error?: string;
};

type BackupActionResponse = {
  ok?: boolean;
  error?: string;
  path?: string;
};

export default function BackupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupItem[]>([]);

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      await loadBackups();
      setReady(true);
    }

    init();
  }, [router]);

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";

    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadBackups() {
    try {
      setLoading(true);
      const headers = await getAuthHeader();

      const res = await fetch("/api/backup-company?mode=list", {
        method: "GET",
        headers,
      });

      const json: BackupListResponse = await res.json();

      if (!res.ok) {
        alert(json.error || "Erro ao listar backups.");
        return;
      }

      setBackups(json.backups || []);
    } catch (error) {
      console.error("Erro ao carregar backups:", error);
      alert("Erro ao carregar backups.");
    } finally {
      setLoading(false);
    }
  }

  async function generateBackupNow() {
    try {
      const headers = await getAuthHeader();

      const res = await fetch("/api/backup-company", {
        method: "POST",
        headers,
      });

      const json: BackupActionResponse = await res.json();

      if (!res.ok) {
        alert(json.error || "Erro ao gerar backup.");
        return;
      }

      alert("BACKUP GERADO COM SUCESSO!");
      await loadBackups();
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      alert("Erro ao gerar backup.");
    }
  }

  async function restoreBackup(path: string) {
    const ok = confirm(
      "RESTAURAR ESTE BACKUP?\n\nIsso vai substituir os dados atuais desta empresa."
    );

    if (!ok) return;

    try {
      const headers = {
        ...(await getAuthHeader()),
        "Content-Type": "application/json",
      };

      const res = await fetch("/api/restore-company", {
        method: "POST",
        headers,
        body: JSON.stringify({ backupPath: path }),
      });

      const json: BackupActionResponse = await res.json();

      if (!res.ok) {
        alert(json.error || "Erro ao restaurar backup.");
        return;
      }

      alert("BACKUP RESTAURADO COM SUCESSO!");
      await loadBackups();
    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      alert("Erro ao restaurar backup.");
    }
  }

  async function downloadBackup(path: string) {
    try {
      const headers = await getAuthHeader();

      const res = await fetch(
        `/api/backup-company?mode=download&path=${encodeURIComponent(path)}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!res.ok) {
        const json: BackupActionResponse = await res.json();
        alert(json.error || "Erro ao baixar backup.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = path.split("/").pop() || "backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar backup:", error);
      alert("Erro ao baixar backup.");
    }
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">BACKUP</h1>
            <p className="text-sm text-[#6C757D] mt-1">
              BACKUP MANUAL E RESTAURAÇÃO POR EMPRESA
            </p>
          </div>

          <button
            className="botao-azul"
            type="button"
            onClick={generateBackupNow}
          >
            GERAR BACKUP AGORA
          </button>
        </div>

        <section className="card mb-6">
          <h2 className="titulo mb-4">COMO ESTA FASE FUNCIONA</h2>

          <div className="space-y-2 text-sm text-[#1F1F1F]">
            <p>• Cada empresa salva seus backups em uma pasta própria.</p>
            <p>• O backup é um arquivo JSON completo dos dados operacionais.</p>
            <p>• A restauração substitui apenas os dados da empresa logada.</p>
          </div>
        </section>

        <section className="card">
          <h2 className="titulo mb-4">BACKUPS DISPONÍVEIS</h2>

          <div className="overflow-auto">
            <table className="tabela min-w-[900px]">
              <thead>
                <tr>
                  <th>ARQUIVO</th>
                  <th>ATUALIZADO</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-[#6C757D]">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-[#6C757D]">
                      NENHUM BACKUP ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  backups.map((item) => (
                    <tr key={item.path}>
                      <td>{item.name}</td>
                      <td>
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleString("pt-BR")
                          : "-"}
                      </td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="botao-mini"
                            type="button"
                            onClick={() => downloadBackup(item.path)}
                          >
                            BAIXAR
                          </button>

                          <button
                            className="botao-mini"
                            type="button"
                            onClick={() => restoreBackup(item.path)}
                          >
                            RESTAURAR
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
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .titulo {
          font-weight: 900;
          font-size: 14px;
          color: #6c757d;
        }

        .botao-azul {
          background: #0456a3;
          color: white;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          border: none;
        }

        .botao-mini {
          border: 1px solid #2f2f2f;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          background: white;
          color: #1f1f1f;
          font-weight: 500;
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