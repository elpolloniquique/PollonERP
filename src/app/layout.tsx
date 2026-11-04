import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SG Proveedores",
  description: "Control de proveedores, facturas y pagos",
  applicationName: "SG Proveedores",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2436F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
