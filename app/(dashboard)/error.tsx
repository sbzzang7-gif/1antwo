"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          화면을 불러오지 못했습니다
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">일시적인 오류가 발생했습니다. 다시 시도해 주세요.</p>
        <Button onClick={reset}>다시 시도</Button>
      </CardContent>
    </Card>
  );
}
