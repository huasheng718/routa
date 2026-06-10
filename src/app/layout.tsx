import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n";
import { ThemeInitializer } from "@/client/components/theme-initializer";

export const metadata: Metadata = {
  title: "Routa - 多智能体协作平台",
  description:
    "基于浏览器的多智能体协作平台，支持 MCP、ACP 和 A2A 协议",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

// Inline script to prevent flash of wrong theme
const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('routa.theme');
      if (!theme || theme === 'system') {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
      document.documentElement.classList.add(theme);
      document.documentElement.dataset.themePreference = localStorage.getItem('routa.theme') || 'system';
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      console.warn('Theme initialization failed:', e);
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeInitializer />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
