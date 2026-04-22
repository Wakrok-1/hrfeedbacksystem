import { UtensilsCrossed, Lock, Zap, Bus } from "lucide-react";
import type { Category } from "@/types/complaint";

const CATEGORIES: {
  key: Category;
  icon: React.ElementType;
  en: string;
  ms: string;
  description: string;
  color: string;
  iconBg: string;
}[] = [
  {
    key: "Canteen",
    icon: UtensilsCrossed,
    en: "Canteen",
    ms: "Kantin",
    description: "Food quality, hygiene, service",
    color: "hover:border-orange-400 hover:bg-orange-50/50",
    iconBg: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  },
  {
    key: "Locker",
    icon: Lock,
    en: "Locker",
    ms: "Loker",
    description: "Damage, key issues, allocation",
    color: "hover:border-blue-400 hover:bg-blue-50/50",
    iconBg: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  },
  {
    key: "ESD",
    icon: Zap,
    en: "ESD",
    ms: "ESD",
    description: "Electrostatic discharge concerns",
    color: "hover:border-yellow-400 hover:bg-yellow-50/50",
    iconBg: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
  },
  {
    key: "Transportation",
    icon: Bus,
    en: "Transportation",
    ms: "Pengangkutan",
    description: "Driver attitude, vehicle issues",
    color: "hover:border-green-400 hover:bg-green-50/50",
    iconBg: "bg-green-50 text-green-600 group-hover:bg-green-100",
  },
];

interface CategorySelectProps {
  onSelect: (category: Category) => void;
}

export function CategorySelect({ onSelect }: CategorySelectProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            Jabil HR Feedback System
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Submit a Complaint
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select the category that best describes your issue ·{" "}
            <span className="text-muted-foreground/70">Pilih kategori yang berkaitan</span>
          </p>
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATEGORIES.map(({ key, icon: Icon, en, ms, description, color, iconBg }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`group flex items-start gap-4 rounded-xl border-2 border-border bg-white p-5 text-left shadow-sm transition-all duration-200 active:scale-[0.98] ${color}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {en} <span className="font-normal text-muted-foreground">/ {ms}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          All submissions are confidential · Semua penghantaran adalah sulit
        </p>
      </div>
    </div>
  );
}
