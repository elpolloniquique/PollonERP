"use client";

import { useParams } from "next/navigation";
import { FichaProveedor } from "@/components/FichaProveedor";

export default function PaginaFicha() {
  const params = useParams<{ id: string }>();
  return <FichaProveedor id={params.id} />;
}
