"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setIsSubmitting(false);
      if (signInError) {
        setError(traduireErreur(signInError.message));
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Sans ça, Supabase renvoie vers la Site URL du projet (souvent "/"),
        // qui ne sait pas échanger le code — voir src/app/auth/callback/route.ts.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setIsSubmitting(false);
    if (signUpError) {
      setError(traduireErreur(signUpError.message));
      return;
    }
    setNotice("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
  }

  return (
    <main className="grid min-h-full flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel — the one moment of boldness on this page. */}
      <div className="flex flex-col justify-between bg-accent px-6 py-10 text-accent-ink sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-ink font-display text-lg font-semibold text-accent">
          C
        </span>
        <div className="max-w-sm">
          <p className="font-display text-3xl italic leading-tight sm:text-4xl">
            Channel Manager
          </p>
          <p className="mt-4 text-sm leading-relaxed text-accent-ink/80">
            Calendrier centralisé, synchronisation multi-plateformes, ménage et tarification —
            le poste de pilotage de tes locations courte durée.
          </p>
        </div>
        <p className="hidden text-xs text-accent-ink/60 lg:block">
          Aucune double réservation ne passe entre les mailles du filet.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-ink">
            {mode === "sign-in" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === "sign-in"
              ? "Accède à tes logements et réservations."
              : "Commence par créer ton compte, tu configureras ton organisation ensuite."}
          </p>

          <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-critical">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-good">
                {notice}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
              {isSubmitting
                ? "Un instant…"
                : mode === "sign-in"
                  ? "Se connecter"
                  : "Créer le compte"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-sm text-ink-soft hover:text-ink"
          >
            {mode === "sign-in"
              ? "Pas encore de compte ? Créer un compte"
              : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </div>
    </main>
  );
}

function traduireErreur(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("User already registered")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (message.includes("Password should be")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  return message;
}
