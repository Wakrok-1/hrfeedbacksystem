import { useState } from "react";
import { CategorySelect } from "./CategorySelect";
import { ComplaintForm } from "./ComplaintForm";
import { SuccessScreen } from "./SuccessScreen";
import type { Category, ComplaintSubmitResult } from "@/types/complaint";

type Screen = "category" | "form" | "success";

export function SubmitPage() {
  const [screen, setScreen] = useState<Screen>("category");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [result, setResult] = useState<ComplaintSubmitResult | null>(null);
  const [emailProvided, setEmailProvided] = useState(false);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setScreen("form");
  };

  const handleSuccess = (res: ComplaintSubmitResult, hasEmail: boolean) => {
    setResult(res);
    setEmailProvided(hasEmail);
    setScreen("success");
  };

  if (screen === "category") {
    return <CategorySelect onSelect={handleCategorySelect} />;
  }

  if (screen === "form" && selectedCategory) {
    return (
      <ComplaintForm
        category={selectedCategory}
        onBack={() => setScreen("category")}
        onSuccess={handleSuccess}
      />
    );
  }

  if (screen === "success" && result) {
    return <SuccessScreen result={result} emailProvided={emailProvided} />;
  }

  return null;
}
