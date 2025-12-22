import "./globals.css";
import Header from "./components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sl">
      <body
        style={{
          margin: 0,
          background: "#0b0b14",
          color: "#ffffff",
        }}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}

