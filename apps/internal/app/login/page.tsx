import { isEnvConfigured } from "@/lib/env";
import { signInWithEmail } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  missing_env: "Supabase environment variables are missing.",
  not_allowed: "That email is not on the internal allowlist.",
  inactive: "Your internal account is not active.",
  signin_failed: "Supabase could not send the sign-in email."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">KSHR Internal</p>
        <h1>Sign in</h1>
        <p className="muted">
          Use an allowlisted email address. We will send a Supabase magic link.
        </p>

        {!isEnvConfigured() ? (
          <p className="alert">Set Supabase environment variables before signing in.</p>
        ) : null}

        {error ? <p className="alert">{messages[error] ?? "Unable to sign in."}</p> : null}
        {sent ? <p className="success">Check your email for the sign-in link.</p> : null}

        <form action={signInWithEmail} className="form-stack">
          <label>
            Email
            <input name="email" type="email" placeholder="you@kshr.ai" required />
          </label>
          <button type="submit">Send magic link</button>
        </form>
      </section>
    </main>
  );
}
