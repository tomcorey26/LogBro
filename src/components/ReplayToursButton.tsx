"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/use-haptics";
import { resetAllTours } from "@/tours/storage";

export function ReplayToursButton() {
  const router = useRouter();
  const { trigger } = useHaptics();

  function handleReplay() {
    resetAllTours();
    trigger("light");
    toast.success("Tours reset — open a page to see them again");
    router.push("/habits");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReplay}>
      Replay tours
    </Button>
  );
}
