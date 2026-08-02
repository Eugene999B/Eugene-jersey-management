"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type ConfirmActionButtonProps = ComponentProps<typeof Button> & {
  confirmation: string;
};

export function ConfirmActionButton({ confirmation, onClick, ...props }: ConfirmActionButtonProps) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmation)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
