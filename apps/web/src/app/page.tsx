"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// O site é aberto ao visitante (papel visualizador), então a entrada é sempre o mapa.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mapa");
  }, [router]);

  return null;
}
