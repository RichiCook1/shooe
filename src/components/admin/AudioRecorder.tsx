import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onRecorded: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
  maxSeconds?: number;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function AudioRecorder({ onRecorded, disabled, maxSeconds = 120 }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        onRecorded(blob, type);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= maxSeconds) {
            try { rec.state !== "inactive" && rec.stop(); } catch {}
            if (timerRef.current) window.clearInterval(timerRef.current);
            setRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Microphone permission denied");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setElapsed(0);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-5xl font-display tracking-wider tabular-nums">
        {fmt(elapsed)} <span className="text-base text-muted-foreground">/ {fmt(maxSeconds)}</span>
      </div>
      {!blobUrl ? (
        <Button
          type="button"
          size="lg"
          onClick={recording ? stop : start}
          disabled={disabled}
          className="h-24 w-24 rounded-full"
          variant={recording ? "destructive" : "default"}
        >
          {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </Button>
      ) : (
        <div className="w-full flex flex-col gap-3 items-center">
          <audio src={blobUrl} controls className="w-full" />
          <Button type="button" variant="outline" onClick={reset} disabled={disabled}>
            <RotateCcw className="h-4 w-4 mr-2" /> Re-record
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {recording ? `Recording… max ${maxSeconds}s` : blobUrl ? "Review and continue" : `Tap to record · up to ${maxSeconds}s`}
      </p>
    </div>
  );
}
