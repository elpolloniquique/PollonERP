"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NuevaFactura() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/facturas?nueva=1");
  }, [router]);
  return <main className="p-4">Abriendo facturas…</main>;
}
