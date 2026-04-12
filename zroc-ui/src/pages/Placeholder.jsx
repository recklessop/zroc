// src/pages/Placeholder.jsx
// Temporary placeholder used for pages not yet built (Phase 2+).
// Displays a construction card so navigation works from day one.
import { Construction } from 'lucide-react';

export default function Placeholder({ title, description }) {
  return (
    <div className="flex items-center justify-center h-full animate-fade-in">
      <div className="card p-12 text-center max-w-md">
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <Construction size={24} className="text-accent" />
        </div>
        <h2 className="font-mono text-base font-semibold text-text-primary mb-2">{title}</h2>
        <p className="text-sm text-text-muted leading-relaxed">{description}</p>
        <p className="mt-4 text-xs font-mono text-text-muted border border-border rounded px-3 py-1.5 inline-block">
          Phase 2 — Coming next
        </p>
      </div>
    </div>
  );
}
