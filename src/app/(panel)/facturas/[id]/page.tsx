"use client";

import { useParams } from "next/navigation";
import { EditorFactura } from "@/components/EditorFactura";

export default function FacturaGuardada() {
  const params = useParams<{ id: string }>();
  return <EditorFactura facturaId={params.id} />;
}
