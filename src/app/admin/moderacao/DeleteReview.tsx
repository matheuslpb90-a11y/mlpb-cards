"use client";

import { useTransition } from "react";
import { deleteReviewAction } from "./actions";

export function DeleteReview({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="rounded-lg border px-2 py-1 text-xs text-red-300 hover:border-red-400 disabled:opacity-40"
      onClick={() => confirm("Remover esta avaliação?") && start(async () => void (await deleteReviewAction(id)))}
    >
      Remover
    </button>
  );
}
