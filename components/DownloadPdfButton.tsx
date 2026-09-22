"use client";

import { useState } from "react";

export default function DownloadPdfButton({
  bookTitle,
  markdown,
}: {
  bookTitle: string;
  markdown: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileName = `${bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "complete-book"}.pdf`;

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle, markdown }),
      });
      if (!response.ok) {
        const data = response.headers.get("content-type")?.includes("application/json")
          ? await response.json().catch(() => null) as { error?: string } | null
          : null;
        throw new Error(data?.error ?? "The PDF could not be generated.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The PDF could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={handleDownload} disabled={loading}>
        {loading ? "Generating PDF..." : "Download PDF"}
      </button>
      {error && <span className="self-center text-xs text-[var(--error)]">{error}</span>}
    </>
  );
}
