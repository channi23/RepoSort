import "./globals.css";
import {
  Epilogue,
  Pixelify_Sans,
  Itim,
  Sintony,
  Italiana,
} from "next/font/google";

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-epilogue",
});

const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-pixelify",
});

const itim = Itim({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-itim",
});

const sintony = Sintony({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-sintony",
});

const italiana = Italiana({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-italiana",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${epilogue.variable}
          ${pixelify.variable}
          ${itim.variable}
          ${sintony.variable}
          ${italiana.variable}
          antialiased
        `}
      >
        {children}
      </body>
    </html>
  );
}