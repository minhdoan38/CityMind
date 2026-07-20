import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LocaleSwitcher from "@/components/LocaleSwitcher";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations("login");
  const nav = await getTranslations("navigation");

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      
      <Card className="w-full max-w-md border border-border shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/session/login" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="officer@citymind.gov"
                required
                autoComplete="email"
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{t("error")}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full min-h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 transition-colors"
            >
              {t("submit")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/report"
              className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {nav("report")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
