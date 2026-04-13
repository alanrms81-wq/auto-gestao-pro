import ImprimirClienteClient from "./ImprimirClienteClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const id = params?.id ?? "";

  return <ImprimirClienteClient id={id} />;
}