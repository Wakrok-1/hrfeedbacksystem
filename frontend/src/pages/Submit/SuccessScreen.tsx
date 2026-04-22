import { CheckCircle2, Copy, ExternalLink, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ComplaintSubmitResult } from "@/types/complaint";

interface SuccessScreenProps {
  result: ComplaintSubmitResult;
  emailProvided: boolean;
}

export function SuccessScreen({ result, emailProvided }: SuccessScreenProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(result.tracking_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Success icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        </div>

        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Complaint Submitted!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aduan Berjaya Dihantar</p>
        </div>

        {/* Reference card */}
        <div className="mb-4 rounded-2xl border-2 border-primary/15 bg-primary/5 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference ID · ID Rujukan</p>
          <p className="mt-2 text-4xl font-bold tracking-widest text-primary">{result.reference_id}</p>
          <p className="mt-2 text-xs text-muted-foreground">Keep this safe · Simpan untuk rekod anda</p>
        </div>

        {/* Tracking link */}
        <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Track your complaint · Jejaki aduan anda
          </p>
          <p className="mb-3 break-all text-xs text-muted-foreground/70">{result.tracking_url}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyLink} className="flex-1 h-8 text-xs">
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button size="sm" asChild className="flex-1 h-8 text-xs">
              <a href={result.tracking_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Track Now
              </a>
            </Button>
          </div>
        </div>

        {emailProvided && (
          <p className="mb-4 text-center text-xs text-muted-foreground">
            A confirmation has been sent to your email · Pengesahan telah dihantar ke e-mel anda
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Submit another complaint · Hantar aduan lain
        </button>
      </div>
    </div>
  );
}
