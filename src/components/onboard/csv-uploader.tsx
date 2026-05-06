"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { parseCsvToRows } from "@/lib/csv";

interface CsvUploaderProps {
  type: "customers" | "visits";
  uploadUrl: string;
  label?: string;
  description?: string;
  requiredColumns?: string[];
  onSuccess?: (result: { inserted: number; skipped: number }) => void;
}

export function CsvUploader({
  type,
  uploadUrl,
  label,
  description,
  requiredColumns = [],
  onSuccess,
}: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFile(f: File | null) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCsvToRows(text);
        setRows(parsed);
        if (parsed.length > 0) setHeaders(Object.keys(parsed[0]));
      } catch {
        setError("Could not parse CSV — ensure it's UTF-8 encoded with a header row.");
      }
    };
    reader.readAsText(f);
  }

  async function handleUpload() {
    if (!rows.length) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, rows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setResult(data);
      toast({
        title: `Import complete`,
        description: `${data.inserted} imported, ${data.skipped} skipped`,
      });
      onSuccess?.({ inserted: data.inserted, skipped: data.skipped });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({ title: "Import failed", description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand-400 transition-colors cursor-pointer group"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 group-hover:text-brand-500 transition-colors" />
        <p className="text-sm font-medium text-gray-700">
          {label ?? `Drop ${type} CSV here`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {description ?? "or click to browse — UTF-8, comma-separated"}
        </p>
        {requiredColumns.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 font-mono">
            Useful columns: {requiredColumns.join(", ")}
          </p>
        )}
      </div>

      {/* File preview */}
      {file && rows.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-gray-700">{file.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} rows detected</span>
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50/70">
                  {headers.slice(0, 8).map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  {headers.length > 8 && <th className="px-3 py-2 text-muted-foreground">+{headers.length - 8} more</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {headers.slice(0, 8).map((h) => (
                      <td key={h} className="px-3 py-1.5 text-gray-700 max-w-[120px] truncate">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-[10px] text-muted-foreground text-center py-2 bg-slate-50 border-t">
              Showing 5 of {rows.length} rows
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{result.inserted} records imported successfully.</p>
            {result.skipped > 0 && <p className="text-xs mt-0.5">{result.skipped} rows skipped (duplicates or missing required fields).</p>}
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-1 text-xs text-red-600 list-disc pl-4 space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Upload button */}
      {rows.length > 0 && !result && (
        <Button
          onClick={handleUpload}
          disabled={loading}
          className="w-full gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {loading ? `Importing ${rows.length} rows…` : `Import ${rows.length} ${type}`}
        </Button>
      )}
    </div>
  );
}
