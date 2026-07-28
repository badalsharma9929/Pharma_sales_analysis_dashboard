import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insurance Business Insights Dashboard",
  description: "Import password-protected Excel files, analyse insurance trends, and export cleaned management reports.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fetchPatch = `
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input === 'string' && input === '/api/analyze') input = '/api/process';
        return originalFetch(input, init);
      };
    })();
  `;
  return <html lang="en"><body><script dangerouslySetInnerHTML={{ __html: fetchPatch }} />{children}</body></html>;
}
