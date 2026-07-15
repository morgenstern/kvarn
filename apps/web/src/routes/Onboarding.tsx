import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, Logo, Modal, SectionLabel } from "@kvarn/ui";
import { ChevronLeft, Coffee, Compass, Copy, Download, MapPin, Package, SlidersHorizontal, Sun, UserPlus } from "lucide-react";
import { equipmentGrindScale, useKvarnStore, type GrindScaleValue } from "../state/store";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { BeanForm } from "../components/BeanForm";
import { GrindScaleFields } from "../components/GrindScaleFields";
import { useT } from "../i18n";
import { authClient } from "../auth/client";
import { setSyncOptedOut } from "../sync/runSync";

const { signUp } = authClient;

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

function generateSecurePassword(): string {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

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

type Step = "welcome" | "grinder" | "machine" | "bean" | "location" | "account" | "install";

// Steps with a visual progress indicator — "welcome" is a splash screen, not
// really a "step", so it's excluded from the dots.
const STEP_ORDER: Step[] = ["grinder", "machine", "bean", "location", "account", "install"];

function StepDots({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  if (idx === -1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 mt-4 mb-1">
      {STEP_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-copper" : i < idx ? "w-2 bg-copper/40" : "w-2 bg-linen"}`}
        />
      ))}
    </div>
  );
}

export function Onboarding() {
  const t = useT("onboarding");
  const tSetup = useT("setup");
  const tSettings = useT("settings");
  const navigate = useNavigate();
  const {
    products,
    equipment,
    beans,
    addCustomEquipment,
    addBean,
    captureWeatherSnapshot,
    setActiveGrinder,
    setActiveMachine,
    setActiveBean,
    setEquipmentGrindScale,
  } = useKvarnStore();

  const [step, setStep] = useState<Step>("welcome");
  const [addedGrinderIds, setAddedGrinderIds] = useState<string[]>([]);
  const [addedMachineIds, setAddedMachineIds] = useState<string[]>([]);
  const [addedBeanIds, setAddedBeanIds] = useState<string[]>([]);
  const [confirmingGrinderId, setConfirmingGrinderId] = useState<string | null>(null);
  const [confirmScale, setConfirmScale] = useState<GrindScaleValue | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const platform = useMemo(detectPlatform, []);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(false);

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
        setSyncOptedOut(false);
        setStep("install");
      }
    } finally {
      setAccountBusy(false);
    }
  }

  function equipmentLabel(id: string): string {
    const eq = equipment.find((e) => e.id === id);
    if (!eq) return "—";
    if (eq.customName) return eq.customName;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : "—";
  }

  function beanLabel(id: string): string {
    const bean = beans.find((b) => b.id === id);
    return bean ? `${bean.roaster} — ${bean.name}` : "—";
  }

  // Prompts for the grind range right after a grinder is added — a one-off
  // snapshot read via getState() since this runs in an event handler, not
  // during render.
  function handleGrinderAdded(id: string) {
    setAddedGrinderIds((ids) => [...ids, id]);
    setConfirmingGrinderId(id);
    setConfirmScale(equipmentGrindScale(useKvarnStore.getState(), id));
  }

  async function saveConfirmedGrindScale() {
    if (!confirmingGrinderId || !confirmScale) return;
    await setEquipmentGrindScale(confirmingGrinderId, confirmScale);
    setConfirmingGrinderId(null);
  }

  // Bundles whatever was added along the way into the user's active picks.
  // Grinders/beans without a sensible generic fallback (unlike equipment,
  // which falls back to "custom gear") get one synthesized here so the app
  // never re-opens onboarding right after finishing it. Machine stays
  // optional — no synthesized fallback needed.
  async function finishOnboarding() {
    let grinderId = addedGrinderIds[0];
    if (!grinderId) {
      const generic = await addCustomEquipment(t("genericGrinderName"), "grinder");
      grinderId = generic.id;
    }
    setActiveGrinder(grinderId);
    setActiveMachine(addedMachineIds[0] ?? null);

    let beanId = addedBeanIds[0];
    if (!beanId) {
      const generic = await addBean({ roaster: t("genericBeanRoaster"), name: t("genericBeanName") });
      beanId = generic.id;
    }
    setActiveBean(beanId);

    markOnboardingSeen();
    navigate({ to: "/bruehen" });
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    setStep(idx <= 0 ? "welcome" : (STEP_ORDER[idx - 1] ?? "welcome"));
  }

  return (
    <div>
      {step === "welcome" ? (
        <div className="flex flex-col items-center text-center pt-6">
          <Logo size={72} />
          <h1 className="font-display text-[34px] mt-4 mb-1">{t("welcomeTitle")}</h1>
          <p className="text-base text-copper font-medium mb-3">{t("welcomeSubtitle")}</p>
          <p className="text-base text-muted mb-6">{t("welcomeDescription")}</p>
          <div className="grid grid-cols-3 gap-4 w-full mb-8">
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-full bg-copper-soft flex items-center justify-center text-[#7a4526]">
                <SlidersHorizontal size={20} strokeWidth={1.5} />
              </span>
              <span className="text-[12px] text-muted leading-tight">{t("welcomeFeatureDialIn")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-full bg-copper-soft flex items-center justify-center text-[#7a4526]">
                <Sun size={20} strokeWidth={1.5} />
              </span>
              <span className="text-[12px] text-muted leading-tight">{t("welcomeFeatureWeather")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-full bg-copper-soft flex items-center justify-center text-[#7a4526]">
                <Compass size={20} strokeWidth={1.5} />
              </span>
              <span className="text-[12px] text-muted leading-tight">{t("welcomeFeatureCompass")}</span>
            </div>
          </div>
          <Button className="w-full" onClick={() => setStep("grinder")}>
            {t("welcomeStart")}
          </Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-0.5 text-[13px] text-muted mt-4 py-2 -my-2 -ml-1"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
            {t("back")}
          </button>
          <StepDots current={step} />
        </>
      )}

      {step === "grinder" ? (
        <>
          <EquipmentSearchSection
            kind="grinder"
            icon={SlidersHorizontal}
            title={t("stepGrinder")}
            placeholder={tSetup("searchPlaceholder")}
            onAdded={handleGrinderAdded}
          />
          {addedGrinderIds.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] text-muted mb-1.5">{t("addedSoFar", { count: addedGrinderIds.length })}</p>
              <div className="flex flex-wrap gap-2">
                {addedGrinderIds.map((id) => (
                  <Chip key={id} active>
                    {equipmentLabel(id)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <Button onClick={() => setStep("machine")}>{addedGrinderIds.length > 0 ? t("next") : t("skip")}</Button>
        </>
      ) : null}

      {confirmingGrinderId && confirmScale ? (
        <Modal onClose={() => setConfirmingGrinderId(null)}>
          <SectionLabel icon={SlidersHorizontal}>{t("confirmGrindScaleTitle")}</SectionLabel>
          <p className="text-base mb-3">{t("confirmGrindScaleQuestion", { name: equipmentLabel(confirmingGrinderId) })}</p>
          <GrindScaleFields value={confirmScale} onChange={setConfirmScale} />
          <Button onClick={saveConfirmedGrindScale}>{tSetup("saveGrindScale")}</Button>
          <Button variant="ghost" onClick={() => setConfirmingGrinderId(null)}>
            {t("skip")}
          </Button>
        </Modal>
      ) : null}

      {step === "machine" ? (
        <>
          <EquipmentSearchSection
            kind="machine"
            icon={Coffee}
            title={t("stepMachine")}
            placeholder={tSetup("searchPlaceholderMachine")}
            onAdded={(id) => setAddedMachineIds((ids) => [...ids, id])}
          />
          {addedMachineIds.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] text-muted mb-1.5">{t("addedSoFar", { count: addedMachineIds.length })}</p>
              <div className="flex flex-wrap gap-2">
                {addedMachineIds.map((id) => (
                  <Chip key={id} active>
                    {equipmentLabel(id)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <Button onClick={() => setStep("bean")}>{addedMachineIds.length > 0 ? t("next") : t("skip")}</Button>
        </>
      ) : null}

      {step === "bean" ? (
        <>
          <Card>
            <SectionLabel icon={Package}>{t("stepBean")}</SectionLabel>
            <p className="text-base mb-3">{t("beanQuestion")}</p>
            <BeanForm onSaved={(bean) => setAddedBeanIds((ids) => [...ids, bean.id])} />
          </Card>
          {addedBeanIds.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] text-muted mb-1.5">{t("addedSoFar", { count: addedBeanIds.length })}</p>
              <div className="flex flex-wrap gap-2">
                {addedBeanIds.map((id) => (
                  <Chip key={id} active>
                    {beanLabel(id)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <Button onClick={() => setStep("location")}>{addedBeanIds.length > 0 ? t("next") : t("skip")}</Button>
        </>
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
          <p className="text-[13px] text-muted mt-3">{t("installSyncNote")}</p>
        </Card>
      ) : null}
    </div>
  );
}
