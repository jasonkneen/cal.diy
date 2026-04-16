"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { v4 as uuidv4 } from "uuid";

export default function NewRoutingFormPage() {
  const router = useRouter();

  // Generate a temporary ID for new form creation
  useEffect(() => {
    const newFormId = uuidv4();
    router.replace(`/settings/routing-forms/${newFormId}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      {/* Brief loader while redirecting */}
      <p className="text-subtle">Loading form editor...</p>
    </div>
  );
}