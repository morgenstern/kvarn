import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, EntityImage, SectionLabel } from "@kvarn/ui";
import type { Setup as SetupType } from "@kvarn/db";
import { Coffee, Copy, Download, MapPin, Package, SlidersHorizontal, UserPlus } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
import { authClient } from "../auth/client";

const { signUp } = authClient;

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

function generateSecurePassword(): string {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];
const ONBOARDING_SEEN_KEY = "kvarn:onboardingSeen";

export function markOnboardingSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
}

// Chrome/Edge-only event (Android + desktop) — no official DOM lib type yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type Step = "method" | "equipment" | "bean" | "location" | "account" | "install";

export function Onboarding() {
  const t = useT("onboarding");
  const tSetup = useT("setup");
  const tRegal = useT("regal");
  const tSettings = useT("settings");
  const navigate = useNavigate();
  const {
    products,
    addEquipmentFromProduct,
    addCustomEquipment,
    addSetup,
    addBean,
    captureWeatherSnapshot,
    setActiveSetup,
    setActiveBean,
  } = useKvarnStore();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<SetupType["method"] | null>(null);
  const [query, setQuery] = useState("");
  const [roaster, setRoaster] = useState("");
  const [beanName, setBeanName] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const platform = useMemo(detectPlatform, []);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.kind === "grinder" && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 6);
  }, [products, query]);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function advanceFromLocation(withWeather: boolean) {
    if (withWeather) {
      captureWeatherSnapshot();
    }
    setStep("account");
  }

  function finishOnboarding() {
    markOnboardingSeen();
    navigate({ to: "/bruehen" });
  }

  function handleGeneratePassword() {
    setPassword(generateSecurePassword());
    setShowPassword(true);
    setPasswordCopied(false);
  }

  async function handleCopyPassword() {
    await navigator.clipboard.writeText(password);
    setPasswordCopied(true);
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(false);
    setAccountBusy(true);
    try {
      const result = await signUp.email({ email, password, name: firstName || email });
      if (result.error) {
        setAccountError(true);
      } else {
        setStep("install");
      }
    } finally {
      setAccountBusy(false);
    }
  }

  // Onboarding represents the user's primary setup/bean — always activate what
  // they just created here, even if an older setup/bean was already active
  // (e.g. leftover local data from a previous install).
  async function pickEquipmentFromProduct(productId: string) {
    const equipment = await addEquipmentFromProduct(productId);
    if (method) {
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  async function pickCustomEquipment() {
    const equipment = await addCustomEquipment(query, "grinder");
    if (method) {
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  // Beans have no sensible generic fallback (unlike equipment's "custom gear"),
  // so this step has no skip — onboarding's whole point is guaranteeing at
  // least one real bean exists before the rest of the app opens up.
  async function saveBean() {
    if (!roaster || !beanName) return;
    const bean = await addBean({ roaster, name: beanName });
    setActiveBean(bean.id);
    setStep("location");
  }

  // Skipping equipment must still leave a usable setup — otherwise the user
  // finishes onboarding with no way to brew, silently defeating its purpose.
  async function skipEquipment() {
    if (method) {
      const equipment = await addCustomEquipment(t("genericGrinderName"), "grinder");
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("welcomeTitle")}</h1>
      <p className="text-base text-muted">{t("welcomeSubtitle")}</p>

      {step === "method" ? (
        <Card>
          <SectionLabel icon={Coffee}>{t("stepMethod")}</SectionLabel>
          <p className="text-base mb-3">{t("methodQuestion")}</p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
                {m}
              </Chip>
            ))}
          </div>
          <Button disabled={!method} onClick={() => setStep("equipment")}>
            {t("next")}
          </Button>
        </Card>
      ) : null}

      {step === "equipment" ? (
        <Card>
          <SectionLabel icon={SlidersHorizontal}>{t("stepEquipment")}</SectionLabel>
          <p className="text-base mb-3">{t("equipmentQuestion")}</p>
          <input
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch w-full"
            placeholder={tSetup("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left text-base py-2 border-b border-linen last:border-b-0 flex items-center gap-3"
              onClick={() => pickEquipmentFromProduct(p.id)}
            >
              <EntityImage src={p.imageUrl} kind="grinder" className="w-14 h-14 rounded-control flex-none" />
              {p.brand} {p.model}
            </button>
          ))}
          {query && filteredProducts.length === 0 ? (
            <button type="button" className="text-[15px] text-copper underline mt-2" onClick={pickCustomEquipment}>
              „{query}“ →
            </button>
          ) : null}
          <Button variant="ghost" onClick={skipEquipment}>
            {t("skip")}
          </Button>
        </Card>
      ) : null}

      {step === "bean" ? (
        <Card>
          <SectionLabel icon={Package}>{t("stepBean")}</SectionLabel>
          <p className="text-base mb-3">{t("beanQuestion")}</p>
          <div className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={tRegal("roasterPlaceholder")}
              value={roaster}
              onChange={(e) => setRoaster(e.target.value)}
            />
            <input
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={tRegal("namePlaceholder")}
              value={beanName}
              onChange={(e) => setBeanName(e.target.value)}
            />
            <Button disabled={!roaster || !beanName} onClick={saveBean}>
              {t("next")}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "location" ? (
        <Card>
          <SectionLabel icon={MapPin}>{t("stepLocation")}</SectionLabel>
          <p className="text-base mb-3">{t("locationQuestion")}</p>
          <p className="text-sm text-muted mb-3">{t("locationExplainer")}</p>
          <Button onClick={() => advanceFromLocation(true)}>{t("locationAllow")}</Button>
          <Button variant="ghost" onClick={() => advanceFromLocation(false)}>
            {t("locationSkip")}
          </Button>
        </Card>
      ) : null}

      {step === "account" ? (
        <Card>
          <SectionLabel icon={UserPlus}>{t("stepAccount")}</SectionLabel>
          <p className="text-base mb-3">{t("accountQuestion")}</p>
          <form onSubmit={handleAccountSubmit} className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={t("firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              type="email"
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={tSettings("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type={showPassword ? "text" : "password"}
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={tSettings("password")}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordCopied(false);
              }}
              required
              minLength={8}
            />
            <div className="flex items-center gap-3 -mt-1">
              <button type="button" className="text-[13px] text-copper underline" onClick={handleGeneratePassword}>
                {t("generatePassword")}
              </button>
              {showPassword && password ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[13px] text-muted underline"
                  onClick={handleCopyPassword}
                >
                  <Copy size={13} strokeWidth={1.5} />
                  {passwordCopied ? t("copied") : t("copyPassword")}
                </button>
              ) : null}
            </div>
            {showPassword && password ? <p className="text-[13px] text-muted -mt-1">{t("passwordGeneratedHint")}</p> : null}
            <Button type="submit" disabled={accountBusy}>
              {t("createAccount")}
            </Button>
            {accountError ? <p className="text-sm text-clay">{tSettings("authError")}</p> : null}
          </form>
          <Button variant="ghost" onClick={() => setStep("install")}>
            {t("accountSkip")}
          </Button>
        </Card>
      ) : null}

      {step === "install" ? (
        <Card>
          <SectionLabel icon={Download}>{t("stepInstall")}</SectionLabel>
          <p className="text-base mb-3">{t("installQuestion")}</p>
          {isStandaloneDisplay() ? (
            <p className="text-sm text-muted mb-3">{t("installAlready")}</p>
          ) : platform === "ios" ? (
            <p className="text-sm text-muted mb-3">{t("installIosHint")}</p>
          ) : deferredPrompt ? (
            <Button variant="ghost" onClick={triggerInstall}>
              <Download size={18} strokeWidth={1.5} />
              {t("installButton")}
            </Button>
          ) : (
            <p className="text-sm text-muted mb-3">
              {platform === "android" ? t("installAndroidHint") : t("installDesktopHint")}
            </p>
          )}
          <Button onClick={finishOnboarding}>{t("finish")}</Button>
        </Card>
      ) : null}
    </div>
  );
}
