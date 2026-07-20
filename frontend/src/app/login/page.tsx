import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeReturnUrl } from "@/lib/safe-return-url";

type Props = {
  searchParams: Promise<{ error?: string; returnUrl?: string }>;
};

/** Officer login stays outside [locale]; EN copy is inline to avoid Wave 2 catalog conflicts. */
export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error;
  const returnUrl = safeReturnUrl(params.returnUrl);

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md border border-border shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in as Officer</CardTitle>
          <CardDescription>
            Access the officer decision-support dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/session/login" method="post" className="space-y-4">
            <input type="hidden" name="returnUrl" value={returnUrl} />
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
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
              <Label htmlFor="password">Password</Label>
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
                <AlertDescription>Invalid email or password.</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full min-h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 transition-colors"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/en"
              className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
