import ImprimirTecnicoClient from "./ImprimirTecnicoClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const id = params?.id ?? "";

  return <ImprimirTecnicoClient id={id} />;
}