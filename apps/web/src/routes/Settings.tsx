import { useState } from "react";
import { Button, Card, SectionLabel } from "@kvarn/ui";
import { sendFeedback } from "@kvarn/api-client";
import { Database, Download, Languages, LogOut, MessageCircle, Send, Trash2, User } from "lucide-react";
import { useT, useLocale, type Locale } from "../i18n";
import { deleteAllLocalData, exportAllData } from "../data/db";
import { authClient } from "../auth/client";

const { signIn, signOut, signUp, useSession } = authClient;

type AuthMode = "signIn" | "signUp";
type SendState = "idle" | "sending" | "sent" | "error";

export function Settings() {
  const t = useT("settings");
  const tCommon = useT("common");
  const { locale, setLocale } = useLocale();
  const { data: session } = useSession();

  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackState, setFeedbackState] = useState<SendState>("idle");

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kvarn-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    await deleteAllLocalData();
    window.location.href = "/";
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);
    const result =
      authMode === "signIn" ? await signIn.email({ email, password }) : await signUp.email({ email, password, name: email });
    if (result.error) {
      setAuthError(true);
    } else {
      setEmail("");
      setPassword("");
    }
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackState("sending");
    try {
      await sendFeedback(feedbackMessage, feedbackEmail);
      setFeedbackState("sent");
      setFeedbackMessage("");
      setFeedbackEmail("");
    } catch {
      setFeedbackState("error");
    }
  }

  const isRealAccount = !!session?.user && !session.user.isAnonymous;

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>

      <Card>
        <SectionLabel icon={Languages}>{t("language")}</SectionLabel>
        <div className="flex gap-2">
          {(["de", "en"] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`px-4 py-2 rounded-control border text-base ${
                locale === l ? "border-copper bg-copper-soft text-[#7a4526]" : "border-linen bg-birch text-espresso"
              }`}
            >
              {l === "de" ? "Deutsch" : "English"}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel icon={User}>{t("account")}</SectionLabel>
        {isRealAccount ? (
          <>
            <p className="text-base">{t("signedInAs", { email: session.user.email })}</p>
            <Button variant="ghost" onClick={() => signOut()}>
              <LogOut size={18} strokeWidth={1.5} />
              {t("signOut")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-base text-muted mb-2">{t("anonymousAccount")}</p>
            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
                placeholder={t("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <Button type="submit">{authMode === "signIn" ? t("signIn") : t("signUp")}</Button>
              {authError ? <p className="text-sm text-clay">{t("authError")}</p> : null}
              <button
                type="button"
                className="text-[15px] text-copper underline"
                onClick={() => setAuthMode(authMode === "signIn" ? "signUp" : "signIn")}
              >
                {authMode === "signIn" ? t("signUpToggle") : t("signInToggle")}
              </button>
            </form>
          </>
        )}
      </Card>

      <Card>
        <SectionLabel icon={Database}>{t("data")}</SectionLabel>
        <Button variant="ghost" onClick={handleExport}>
          <Download size={18} strokeWidth={1.5} />
          {t("exportData")}
        </Button>
        {!confirmingDelete ? (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={18} strokeWidth={1.5} />
            {t("deleteData")}
          </Button>
        ) : (
          <>
            <p className="text-base text-clay mt-3">{t("deleteConfirm")}</p>
            <Button onClick={handleDelete}>{t("deleteConfirmButton")}</Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {tCommon("cancel")}
            </Button>
          </>
        )}
      </Card>

      <Card>
        <SectionLabel icon={MessageCircle}>{t("feedback")}</SectionLabel>
        <p className="text-base text-muted mb-2">{t("feedbackIntro")}</p>
        <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-3">
          <textarea
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch min-h-24"
            placeholder={t("feedbackPlaceholder")}
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            required
          />
          <input
            type="email"
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
            placeholder={t("feedbackEmailPlaceholder")}
            value={feedbackEmail}
            onChange={(e) => setFeedbackEmail(e.target.value)}
          />
          <Button type="submit" disabled={feedbackState === "sending"}>
            <Send size={18} strokeWidth={1.5} />
            {t("feedbackSend")}
          </Button>
          {feedbackState === "sent" ? <p className="text-sm text-sage">{t("feedbackSent")}</p> : null}
          {feedbackState === "error" ? <p className="text-sm text-clay">{t("feedbackError")}</p> : null}
        </form>
      </Card>
    </div>
  );
}
