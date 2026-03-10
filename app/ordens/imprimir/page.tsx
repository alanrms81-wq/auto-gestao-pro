import { Suspense } from "react";

function ImpressaoOSContent({
  id,
}: {
  id?: string;
}) {
  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IMPRESSÃO OS</h1>
      <p>ID DA OS: {id || "NÃO INFORMADO"}</p>
    </div>
  );
}

export default async function ImprimirOSPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={<div style={{ padding: 24 }}>CARREGANDO...</div>}>
      <ImpressaoOSContent id={params?.id} />
    </Suspense>
  );
}